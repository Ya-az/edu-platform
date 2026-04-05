import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { sampleQuestions } from '../data/sampleQuestions';
import { CATEGORIES, DIFFICULTY } from '../utils/constants';
import { shuffleArray } from '../utils/helpers';

const QUESTIONS_COLLECTION = 'questions';
const DEMO_QUESTIONS_KEY = 'edu-platform-demo-questions';
const VALID_CATEGORIES = new Set([CATEGORIES.QUANTITATIVE, CATEGORIES.VERBAL]);
const VALID_DIFFICULTY = new Set([DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function isFirebaseConfigured() {
  const requiredValues = [
    import.meta.env.VITE_FIREBASE_API_KEY,
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    import.meta.env.VITE_FIREBASE_APP_ID,
  ];

  return requiredValues.every(
    (value) => isNonEmptyString(value) && !String(value).trim().startsWith('YOUR_')
  );
}

function normalizeOptions(options = []) {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => (typeof option === 'string' ? option.trim() : ''))
    .filter(Boolean)
    .slice(0, 4);
}

function resolveCorrectAnswer(correctAnswer, options) {
  if (typeof correctAnswer === 'number' && correctAnswer >= 0 && correctAnswer < options.length) {
    return correctAnswer;
  }

  if (typeof correctAnswer === 'string') {
    const trimmedValue = correctAnswer.trim();
    const numericValue = Number(trimmedValue);

    if (Number.isInteger(numericValue) && numericValue >= 0 && numericValue < options.length) {
      return numericValue;
    }

    const optionIndex = options.findIndex(
      (option) => option.toLowerCase() === trimmedValue.toLowerCase()
    );

    if (optionIndex !== -1) {
      return optionIndex;
    }
  }

  return 0;
}

function getDemoQuestionBank() {
  const fallbackQuestions = sampleQuestions.map((question) => ({ ...question }));

  if (!canUseStorage()) {
    return fallbackQuestions;
  }

  try {
    const rawValue = localStorage.getItem(DEMO_QUESTIONS_KEY);

    if (!rawValue) {
      localStorage.setItem(DEMO_QUESTIONS_KEY, JSON.stringify(fallbackQuestions));
      return fallbackQuestions;
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
      localStorage.setItem(DEMO_QUESTIONS_KEY, JSON.stringify(fallbackQuestions));
      return fallbackQuestions;
    }

    const mergedQuestions = [...parsedValue];
    const existingIds = new Set(parsedValue.map((question) => question?.id).filter(Boolean));

    fallbackQuestions.forEach((question) => {
      if (!existingIds.has(question.id)) {
        mergedQuestions.push(question);
      }
    });

    if (mergedQuestions.length !== parsedValue.length) {
      localStorage.setItem(DEMO_QUESTIONS_KEY, JSON.stringify(mergedQuestions));
    }

    return mergedQuestions;
  } catch {
    return fallbackQuestions;
  }
}

function setDemoQuestionBank(questions) {
  if (!canUseStorage()) return;
  localStorage.setItem(DEMO_QUESTIONS_KEY, JSON.stringify(questions));
}

export function normalizeQuestionRecord(record = {}, fallbackId = '') {
  const options = normalizeOptions(record.options);

  return {
    id: record.id || fallbackId,
    text: isNonEmptyString(record.text) ? record.text.trim() : '',
    options,
    correctAnswer: resolveCorrectAnswer(record.correctAnswer, options),
    explanation: isNonEmptyString(record.explanation) ? record.explanation.trim() : '',
    difficulty: VALID_DIFFICULTY.has(record.difficulty) ? record.difficulty : DIFFICULTY.MEDIUM,
    category: VALID_CATEGORIES.has(record.category) ? record.category : CATEGORIES.QUANTITATIVE,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    source: record.source || 'firestore',
  };
}

function applyFilters(questions, filters = {}) {
  return questions.filter((question) => {
    const matchCategory =
      !filters.category || filters.category === CATEGORIES.BOTH || question.category === filters.category;

    const matchDifficulty =
      !filters.difficulty ||
      filters.difficulty === DIFFICULTY.ALL ||
      question.difficulty === filters.difficulty;

    return matchCategory && matchDifficulty;
  });
}

function applyLimit(questions, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return questions;
  return questions.slice(0, limit);
}

function buildStats(questions, source = 'firestore') {
  const initialCounts = {
    total: questions.length,
    byCategory: {
      [CATEGORIES.QUANTITATIVE]: 0,
      [CATEGORIES.VERBAL]: 0,
    },
    byDifficulty: {
      [DIFFICULTY.EASY]: 0,
      [DIFFICULTY.MEDIUM]: 0,
      [DIFFICULTY.HARD]: 0,
    },
    source,
  };

  return questions.reduce((stats, question) => {
    stats.byCategory[question.category] += 1;
    stats.byDifficulty[question.difficulty] += 1;
    return stats;
  }, initialCounts);
}

function prepareQuestionForWrite(questionData) {
  const normalized = normalizeQuestionRecord(questionData);

  if (!normalized.text) {
    throw new Error('Question text is required.');
  }

  if (normalized.options.length < 2) {
    throw new Error('Each question must include at least two answer options.');
  }

  return {
    text: normalized.text,
    options: normalized.options,
    correctAnswer: normalized.correctAnswer,
    explanation: normalized.explanation,
    difficulty: normalized.difficulty,
    category: normalized.category,
  };
}

function ensureFirestoreWriteAccess() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured yet. Add your environment variables before saving questions.');
  }
}

async function fetchFirestoreQuestions() {
  const snapshot = await getDocs(collection(db, QUESTIONS_COLLECTION));

  return snapshot.docs.map((questionDoc) =>
    normalizeQuestionRecord(questionDoc.data(), questionDoc.id)
  );
}

export async function getQuestions(filters = {}) {
  const { limit, shuffle = false } = filters;

  const getDemoQuestions = () => {
    const normalizedQuestions = getDemoQuestionBank().map((question, index) =>
      normalizeQuestionRecord(question, question.id || `demo-${index + 1}`)
    );
    const filteredQuestions = applyFilters(normalizedQuestions, filters);
    const orderedQuestions = shuffle ? shuffleArray(filteredQuestions) : filteredQuestions;
    return applyLimit(orderedQuestions, limit).map((question) => ({ ...question, source: 'demo' }));
  };

  if (!isFirebaseConfigured()) {
    return getDemoQuestions();
  }

  try {
    const questions = await fetchFirestoreQuestions();
    const filteredQuestions = applyFilters(questions, filters);
    const orderedQuestions = shuffle ? shuffleArray(filteredQuestions) : filteredQuestions;

    return applyLimit(orderedQuestions, limit);
  } catch {
    return getDemoQuestions();
  }
}

export async function getQuestionStats() {
  if (!isFirebaseConfigured()) {
    const demoQuestions = getDemoQuestionBank().map((question, index) =>
      normalizeQuestionRecord(question, question.id || `demo-${index + 1}`)
    );
    return buildStats(demoQuestions, 'demo');
  }

  try {
    const allQuestions = await fetchFirestoreQuestions();
    return buildStats(allQuestions, 'firestore');
  } catch {
    const demoQuestions = getDemoQuestionBank().map((question, index) =>
      normalizeQuestionRecord(question, question.id || `demo-${index + 1}`)
    );
    return buildStats(demoQuestions, 'demo');
  }
}

export async function getQuestionById(questionId) {
  if (!questionId) {
    throw new Error('Question id is required.');
  }

  if (!isFirebaseConfigured()) {
    return getDemoQuestionBank().find((question) => question.id === questionId) || null;
  }

  try {
    const questionRef = doc(db, QUESTIONS_COLLECTION, questionId);
    const questionSnapshot = await getDoc(questionRef);

    if (!questionSnapshot.exists()) {
      return null;
    }

    return normalizeQuestionRecord(questionSnapshot.data(), questionSnapshot.id);
  } catch {
    return getDemoQuestionBank().find((question) => question.id === questionId) || null;
  }
}

export async function buildExamQuestionSet(settings = {}) {
  const questionCount = Number(settings.questionCount) || 10;
  const availableQuestions = await getQuestions({
    category: settings.category,
    difficulty: settings.difficulty,
    shuffle: true,
  });

  return availableQuestions.slice(0, questionCount);
}

export async function createQuestion(questionData) {
  const payload = prepareQuestionForWrite(questionData);

  if (!isFirebaseConfigured()) {
    const nextQuestion = normalizeQuestionRecord({
      id: `demo-local-${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'demo',
    });

    const currentQuestions = getDemoQuestionBank();
    setDemoQuestionBank([nextQuestion, ...currentQuestions]);
    return nextQuestion.id;
  }

  const docRef = await addDoc(collection(db, QUESTIONS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateQuestion(questionId, updates) {
  if (!questionId) {
    throw new Error('Question id is required.');
  }

  const payload = prepareQuestionForWrite(updates);

  if (!isFirebaseConfigured()) {
    const updatedQuestions = getDemoQuestionBank().map((question) =>
      question.id === questionId
        ? {
            ...question,
            ...payload,
            updatedAt: new Date().toISOString(),
            source: 'demo',
          }
        : question
    );

    setDemoQuestionBank(updatedQuestions);
    return;
  }

  ensureFirestoreWriteAccess();
  await updateDoc(doc(db, QUESTIONS_COLLECTION, questionId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteQuestion(questionId) {
  if (!questionId) {
    throw new Error('Question id is required.');
  }

  if (!isFirebaseConfigured()) {
    const updatedQuestions = getDemoQuestionBank().filter((question) => question.id !== questionId);
    setDemoQuestionBank(updatedQuestions);
    return;
  }

  ensureFirestoreWriteAccess();
  await deleteDoc(doc(db, QUESTIONS_COLLECTION, questionId));
}

export async function importQuestionsBatch(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return 0;
  }

  if (!isFirebaseConfigured()) {
    const preparedQuestions = questions.map((question, index) =>
      normalizeQuestionRecord({
        id: `demo-batch-${Date.now()}-${index}`,
        ...prepareQuestionForWrite(question),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'demo',
      })
    );

    setDemoQuestionBank([...preparedQuestions, ...getDemoQuestionBank()]);
    return preparedQuestions.length;
  }

  ensureFirestoreWriteAccess();
  const batch = writeBatch(db);

  questions.forEach((question) => {
    const payload = prepareQuestionForWrite(question);
    const newQuestionRef = doc(collection(db, QUESTIONS_COLLECTION));

    batch.set(newQuestionRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return questions.length;
}
