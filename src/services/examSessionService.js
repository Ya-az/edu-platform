import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { buildExamQuestionSet } from './questionService';
import { CATEGORIES, EXAM_MODES } from '../utils/constants';
import { calculateScore } from '../utils/helpers';

const EXAM_SESSIONS_COLLECTION = 'examSessions';
const USER_ANALYTICS_COLLECTION = 'userAnalytics';
const LOCAL_EXAM_SESSIONS_KEY = 'edu-platform-exam-sessions';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readLocalSessions() {
  if (!canUseStorage()) return [];

  try {
    const rawValue = localStorage.getItem(LOCAL_EXAM_SESSIONS_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function writeLocalSessions(sessions) {
  if (!canUseStorage()) return;
  localStorage.setItem(LOCAL_EXAM_SESSIONS_KEY, JSON.stringify(sessions));
}

function toComparableTime(value) {
  if (!value) return 0;

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value).getTime();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }

  return 0;
}

function buildBaseSectionScores() {
  return {
    [CATEGORIES.QUANTITATIVE]: { correct: 0, total: 0, score: 0 },
    [CATEGORIES.VERBAL]: { correct: 0, total: 0, score: 0 },
  };
}

function buildEmptyAnalytics() {
  return {
    totalExams: 0,
    avgScore: 0,
    bestScore: 0,
    latestScore: 0,
    scoreImprovement: 0,
    completionRate: 0,
    recentScores: [],
    recentActivity: [],
    sectionPerformance: [],
    weakAreas: [],
    strongAreas: [],
    suggestions: [],
    modeBreakdown: [],
  };
}

function getPerformanceLevel(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'average';
  return 'needs-focus';
}

function normalizeSession(session = {}) {
  return {
    ...session,
    questions: Array.isArray(session.questions) ? session.questions : [],
    answers: session.answers || {},
    markedQuestions: Array.isArray(session.markedQuestions) ? session.markedQuestions : [],
    sectionScores: session.sectionScores || buildBaseSectionScores(),
    status: session.status || 'in-progress',
    mode: session.mode || EXAM_MODES.PRACTICE,
    timerMinutes: Number(session.timerMinutes || 0),
    remainingSeconds: Number(session.remainingSeconds || 0),
    currentIndex: Number(session.currentIndex || 0),
    savedAt: session.savedAt || session.updatedAt || null,
  };
}

function calculateSectionScores(questions, answers) {
  const sectionScores = buildBaseSectionScores();

  questions.forEach((question) => {
    const category = question.category || CATEGORIES.QUANTITATIVE;

    if (!sectionScores[category]) {
      sectionScores[category] = { correct: 0, total: 0, score: 0 };
    }

    sectionScores[category].total += 1;

    if (answers[question.id] === question.correctAnswer) {
      sectionScores[category].correct += 1;
    }
  });

  Object.keys(sectionScores).forEach((category) => {
    sectionScores[category].score = calculateScore(
      sectionScores[category].correct,
      sectionScores[category].total
    );
  });

  return sectionScores;
}

function buildReviewItems(questions, answers, markedQuestions = []) {
  return questions.map((question) => {
    const hasAnswer = Object.prototype.hasOwnProperty.call(answers, question.id);
    const selectedAnswer = hasAnswer ? Number(answers[question.id]) : null;
    const isCorrect = selectedAnswer === question.correctAnswer;

    return {
      ...question,
      selectedAnswer,
      isCorrect,
      isAnswered: hasAnswer,
      isMarked: markedQuestions.includes(question.id),
    };
  });
}

function calculateSessionSummary(session, answers, remainingSeconds = 0, markedQuestions = []) {
  const reviewItems = buildReviewItems(session.questions, answers, markedQuestions);
  const correctAnswers = reviewItems.filter((item) => item.isCorrect).length;
  const skipped = reviewItems.filter((item) => !item.isAnswered).length;
  const wrongAnswers = reviewItems.length - correctAnswers - skipped;
  const score = calculateScore(correctAnswers, reviewItems.length);
  const accuracy = calculateScore(correctAnswers, Math.max(correctAnswers + wrongAnswers, 1));
  const completionRate = calculateScore(reviewItems.length - skipped, reviewItems.length || 1);
  const sectionScores = calculateSectionScores(session.questions, answers);
  const initialDurationSeconds = Number(session.timerMinutes || 0) * 60;
  const timeTakenSeconds =
    session.mode === EXAM_MODES.TIMED
      ? Math.max(initialDurationSeconds - Number(remainingSeconds || 0), 0)
      : null;

  const sectionEntries = Object.entries(sectionScores);
  const strongestSection = [...sectionEntries].sort((a, b) => b[1].score - a[1].score)[0]?.[0] || null;
  const weakestSection = [...sectionEntries].sort((a, b) => a[1].score - b[1].score)[0]?.[0] || null;

  return {
    score,
    accuracy,
    completionRate,
    performanceLevel: getPerformanceLevel(score),
    correctAnswers,
    wrongAnswers,
    skipped,
    sectionScores,
    reviewItems,
    strongestSection,
    weakestSection,
    timeTakenSeconds,
  };
}

function buildAnalyticsFromSessions(sessions = []) {
  if (!sessions.length) {
    return buildEmptyAnalytics();
  }

  const avgScore = Math.round(
    sessions.reduce((sum, session) => sum + Number(session.score || 0), 0) / sessions.length
  );
  const bestScore = Math.max(...sessions.map((session) => Number(session.score || 0)));

  const sortedSessions = [...sessions].sort(
    (a, b) => toComparableTime(a.submittedAt || a.startedAt) - toComparableTime(b.submittedAt || b.startedAt)
  );

  const firstScore = Number(sortedSessions[0]?.score || 0);
  const latestScore = Number(sortedSessions[sortedSessions.length - 1]?.score || 0);
  const scoreImprovement = latestScore - firstScore;
  const completionRate = Math.round(
    sortedSessions.reduce((sum, session) => sum + Number(session.completionRate || 0), 0) / sortedSessions.length
  );

  const recentScores = sortedSessions.slice(-6).map((session, index) => ({
    name: `#${index + 1}`,
    score: Number(session.score || 0),
    mode: session.mode,
  }));

  const recentActivity = [...sortedSessions]
    .slice(-5)
    .reverse()
    .map((session, index) => ({
      id: session.id,
      label: `#${sortedSessions.length - index}`,
      score: Number(session.score || 0),
      mode: session.mode,
      questionCount: Number(session.questionCount || session.questions?.length || 0),
      submittedAt: session.submittedAt || session.startedAt || null,
      performanceLevel: session.performanceLevel || getPerformanceLevel(Number(session.score || 0)),
    }));

  const categoryMap = {
    [CATEGORIES.QUANTITATIVE]: { name: CATEGORIES.QUANTITATIVE, score: 0, total: 0 },
    [CATEGORIES.VERBAL]: { name: CATEGORIES.VERBAL, score: 0, total: 0 },
  };

  const modeMap = {
    [EXAM_MODES.PRACTICE]: { name: EXAM_MODES.PRACTICE, count: 0, avgScore: 0 },
    [EXAM_MODES.TIMED]: { name: EXAM_MODES.TIMED, count: 0, avgScore: 0 },
  };

  sessions.forEach((session) => {
    Object.entries(session.sectionScores || {}).forEach(([category, stats]) => {
      if (!categoryMap[category]) {
        categoryMap[category] = { name: category, score: 0, total: 0 };
      }

      categoryMap[category].score += Number(stats?.score || 0);
      categoryMap[category].total += 1;
    });

    const modeKey = session.mode || EXAM_MODES.PRACTICE;

    if (!modeMap[modeKey]) {
      modeMap[modeKey] = { name: modeKey, count: 0, avgScore: 0 };
    }

    modeMap[modeKey].count += 1;
    modeMap[modeKey].avgScore += Number(session.score || 0);
  });

  const sectionPerformance = Object.values(categoryMap).map((item) => ({
    name: item.name,
    score: item.total ? Math.round(item.score / item.total) : 0,
  }));

  const weakAreas = sectionPerformance
    .filter((item) => item.score > 0 && item.score < 70)
    .sort((a, b) => a.score - b.score)
    .map((item) => ({
      ...item,
      priority: item.score < 50 ? 'high' : 'medium',
    }));

  const strongAreas = sectionPerformance
    .filter((item) => item.score >= 80)
    .sort((a, b) => b.score - a.score);

  const suggestions = weakAreas.map((item) => ({
    category: item.name,
    score: item.score,
    targetQuestions: item.score < 50 ? 20 : 12,
  }));

  const modeBreakdown = Object.values(modeMap).map((item) => ({
    name: item.name,
    count: item.count,
    avgScore: item.count ? Math.round(item.avgScore / item.count) : 0,
  }));

  return {
    totalExams: sessions.length,
    avgScore,
    bestScore,
    latestScore,
    scoreImprovement,
    completionRate,
    recentScores,
    recentActivity,
    sectionPerformance,
    weakAreas,
    strongAreas,
    suggestions,
    modeBreakdown,
  };
}

async function getRemoteSessions() {
  const snapshot = await getDocs(collection(db, EXAM_SESSIONS_COLLECTION));
  return snapshot.docs.map((sessionDoc) => normalizeSession({ id: sessionDoc.id, ...sessionDoc.data() }));
}

async function persistUserAnalyticsSnapshot(userId) {
  if (!userId || !isFirebaseConfigured()) {
    return null;
  }

  const sessions = (await getUserExamSessions(userId)).filter((session) => session.status === 'completed');
  const analytics = buildAnalyticsFromSessions(sessions);

  await setDoc(
    doc(db, USER_ANALYTICS_COLLECTION, userId),
    {
      userId,
      ...analytics,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return analytics;
}

export async function createExamSession({
  userId,
  mode = EXAM_MODES.PRACTICE,
  category,
  difficulty,
  questionCount = 10,
  timerMinutes = 30,
}) {
  const questions = await buildExamQuestionSet({
    category,
    difficulty,
    questionCount,
  });

  if (!questions.length) {
    throw new Error('No questions are available for the selected settings.');
  }

  const sessionId = `session-${Date.now()}`;
  const sessionPayload = normalizeSession({
    id: sessionId,
    userId,
    mode,
    category,
    difficulty,
    questionCount: Number(questionCount),
    timerMinutes: Number(timerMinutes),
    questions,
    answers: {},
    markedQuestions: [],
    currentIndex: 0,
    remainingSeconds: mode === EXAM_MODES.TIMED ? Number(timerMinutes) * 60 : 0,
    status: 'in-progress',
    score: 0,
    accuracy: 0,
    completionRate: 0,
    performanceLevel: 'needs-focus',
    correctAnswers: 0,
    wrongAnswers: 0,
    skipped: questions.length,
    sectionScores: buildBaseSectionScores(),
    startedAt: new Date().toISOString(),
    submittedAt: null,
    savedAt: new Date().toISOString(),
    source: isFirebaseConfigured() ? 'firestore' : 'demo',
  });

  if (!isFirebaseConfigured()) {
    const sessions = readLocalSessions();
    writeLocalSessions([sessionPayload, ...sessions]);
    return sessionPayload.id;
  }

  const sessionRef = doc(collection(db, EXAM_SESSIONS_COLLECTION));
  await setDoc(sessionRef, {
    ...sessionPayload,
    id: sessionRef.id,
    startedAt: serverTimestamp(),
    savedAt: serverTimestamp(),
  });

  return sessionRef.id;
}

export async function getExamSessionById(sessionId) {
  if (!sessionId) return null;

  if (!isFirebaseConfigured()) {
    const session = readLocalSessions().find((item) => item.id === sessionId);
    return session ? normalizeSession(session) : null;
  }

  try {
    const sessionSnapshot = await getDoc(doc(db, EXAM_SESSIONS_COLLECTION, sessionId));

    if (!sessionSnapshot.exists()) {
      return null;
    }

    return normalizeSession({ id: sessionSnapshot.id, ...sessionSnapshot.data() });
  } catch {
    const session = readLocalSessions().find((item) => item.id === sessionId);
    return session ? normalizeSession(session) : null;
  }
}

export async function getActiveExamSession(userId) {
  if (!userId) return null;

  const sessions = await getUserExamSessions(userId);
  return sessions.find((session) => session.status === 'in-progress') || null;
}

export async function saveExamProgress(sessionId, { answers, currentIndex, remainingSeconds, markedQuestions }) {
  if (!sessionId) return null;

  const savedAt = new Date().toISOString();

  if (!isFirebaseConfigured()) {
    const sessions = readLocalSessions().map((session) =>
      session.id === sessionId
        ? {
            ...session,
            answers: answers ?? session.answers,
            markedQuestions: markedQuestions ?? session.markedQuestions,
            currentIndex: typeof currentIndex === 'number' ? currentIndex : session.currentIndex,
            remainingSeconds:
              typeof remainingSeconds === 'number' ? remainingSeconds : session.remainingSeconds,
            savedAt,
            updatedAt: savedAt,
          }
        : session
    );

    writeLocalSessions(sessions);
    return savedAt;
  }

  await updateDoc(doc(db, EXAM_SESSIONS_COLLECTION, sessionId), {
    ...(answers ? { answers } : {}),
    ...(markedQuestions ? { markedQuestions } : {}),
    ...(typeof currentIndex === 'number' ? { currentIndex } : {}),
    ...(typeof remainingSeconds === 'number' ? { remainingSeconds } : {}),
    savedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return savedAt;
}

export async function submitExamSession(
  sessionId,
  { answers = {}, remainingSeconds = 0, markedQuestions = [] } = {}
) {
  const session = await getExamSessionById(sessionId);

  if (!session) {
    throw new Error('Exam session not found.');
  }

  const mergedAnswers = {
    ...session.answers,
    ...answers,
  };

  const mergedMarkedQuestions = Array.isArray(markedQuestions)
    ? markedQuestions
    : session.markedQuestions || [];

  const summary = calculateSessionSummary(
    session,
    mergedAnswers,
    remainingSeconds,
    mergedMarkedQuestions
  );
  const completedSession = {
    ...session,
    answers: mergedAnswers,
    markedQuestions: mergedMarkedQuestions,
    remainingSeconds,
    status: 'completed',
    submittedAt: new Date().toISOString(),
    savedAt: new Date().toISOString(),
    ...summary,
  };

  if (!isFirebaseConfigured()) {
    const sessions = readLocalSessions().map((item) =>
      item.id === sessionId ? completedSession : item
    );
    writeLocalSessions(sessions);
    return completedSession;
  }

  await updateDoc(doc(db, EXAM_SESSIONS_COLLECTION, sessionId), {
    answers: mergedAnswers,
    markedQuestions: mergedMarkedQuestions,
    remainingSeconds,
    status: 'completed',
    submittedAt: serverTimestamp(),
    savedAt: serverTimestamp(),
    score: summary.score,
    accuracy: summary.accuracy,
    completionRate: summary.completionRate,
    performanceLevel: summary.performanceLevel,
    correctAnswers: summary.correctAnswers,
    wrongAnswers: summary.wrongAnswers,
    skipped: summary.skipped,
    sectionScores: summary.sectionScores,
    reviewItems: summary.reviewItems,
    strongestSection: summary.strongestSection,
    weakestSection: summary.weakestSection,
    timeTakenSeconds: summary.timeTakenSeconds,
    updatedAt: serverTimestamp(),
  });

  await persistUserAnalyticsSnapshot(session.userId);
  return completedSession;
}

export async function getUserExamSessions(userId) {
  if (!userId) return [];

  if (!isFirebaseConfigured()) {
    return readLocalSessions()
      .map(normalizeSession)
      .filter((session) => session.userId === userId)
      .sort(
        (a, b) =>
          toComparableTime(b.submittedAt || b.startedAt) - toComparableTime(a.submittedAt || a.startedAt)
      );
  }

  try {
    const sessions = await getRemoteSessions();
    return sessions
      .filter((session) => session.userId === userId)
      .sort(
        (a, b) =>
          toComparableTime(b.submittedAt || b.startedAt) - toComparableTime(a.submittedAt || a.startedAt)
      );
  } catch {
    return readLocalSessions()
      .map(normalizeSession)
      .filter((session) => session.userId === userId)
      .sort(
        (a, b) =>
          toComparableTime(b.submittedAt || b.startedAt) - toComparableTime(a.submittedAt || a.startedAt)
      );
  }
}

export async function getUserAnalytics(userId) {
  const sessions = (await getUserExamSessions(userId)).filter(
    (session) => session.status === 'completed'
  );

  const analytics = buildAnalyticsFromSessions(sessions);

  if (isFirebaseConfigured() && userId && sessions.length > 0) {
    await setDoc(
      doc(db, USER_ANALYTICS_COLLECTION, userId),
      {
        userId,
        ...analytics,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return analytics;
}
