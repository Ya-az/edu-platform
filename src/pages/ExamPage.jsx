import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  CheckCircle2,
  Clock3,
  Flag,
  RotateCcw,
  Save,
  Timer,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import Loader from '../components/common/Loader';
import Modal from '../components/common/Modal';
import ProgressBar from '../components/common/ProgressBar';
import {
  getExamSessionById,
  saveExamProgress,
  submitExamSession,
} from '../services/examSessionService';
import { EXAM_MODES } from '../utils/constants';
import { formatTime } from '../utils/helpers';
import './ExamPage.css';

export default function ExamPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const autoSubmittedRef = useRef(false);
  const progressRef = useRef({
    answers: {},
    currentIndex: 0,
    timeRemaining: 0,
    markedQuestions: [],
  });

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedQuestions, setMarkedQuestions] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const examSession = await getExamSessionById(sessionId);

      if (!examSession) {
        setError(t('exam.sessionNotFound'));
        return;
      }

      if (examSession.status === 'completed') {
        navigate(`/results/${sessionId}`, { replace: true });
        return;
      }

      const safeIndex = Math.min(
        Number(examSession.currentIndex || 0),
        Math.max((examSession.questions?.length || 1) - 1, 0)
      );

      setSession(examSession);
      setAnswers(examSession.answers || {});
      setMarkedQuestions(examSession.markedQuestions || []);
      setCurrentIndex(safeIndex);
      setTimeRemaining(examSession.remainingSeconds || Number(examSession.timerMinutes || 0) * 60);
      setLastSavedAt(examSession.savedAt || examSession.updatedAt || examSession.startedAt || null);
      setSaveState(examSession.savedAt ? 'saved' : 'idle');
    } catch (loadError) {
      setError(loadError.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [navigate, sessionId, t]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    progressRef.current = {
      answers,
      currentIndex,
      timeRemaining,
      markedQuestions,
    };
  }, [answers, currentIndex, markedQuestions, timeRemaining]);

  const persistProgress = useCallback(
    async (overrides = {}) => {
      if (!sessionId || !session || session.status === 'completed') {
        return;
      }

      setSaveState('saving');

      try {
        const savedAt = await saveExamProgress(sessionId, {
          answers: overrides.answers ?? progressRef.current.answers,
          currentIndex:
            typeof overrides.currentIndex === 'number'
              ? overrides.currentIndex
              : progressRef.current.currentIndex,
          remainingSeconds:
            typeof overrides.remainingSeconds === 'number'
              ? overrides.remainingSeconds
              : progressRef.current.timeRemaining,
          markedQuestions: overrides.markedQuestions ?? progressRef.current.markedQuestions,
        });

        setLastSavedAt(savedAt || new Date().toISOString());
        setSaveState('saved');
      } catch (persistError) {
        setSaveState('error');
        setError(persistError.message || t('common.error'));
      }
    },
    [session, sessionId, t]
  );

  useEffect(() => {
    if (!session || session.mode !== EXAM_MODES.TIMED || session.status === 'completed') {
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeRemaining((previousValue) => Math.max(previousValue - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || session.status === 'completed') {
      return undefined;
    }

    const interval = setInterval(() => {
      void persistProgress();
    }, 15000);

    return () => clearInterval(interval);
  }, [persistProgress, session]);

  useEffect(() => {
    if (!session || session.status === 'completed') {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      void saveExamProgress(sessionId, {
        answers: progressRef.current.answers,
        currentIndex: progressRef.current.currentIndex,
        remainingSeconds: progressRef.current.timeRemaining,
        markedQuestions: progressRef.current.markedQuestions,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [session, sessionId]);

  const finalizeExam = useCallback(
    async (autoSubmit = false) => {
      if (submitting) return;

      setSubmitting(true);
      setError('');

      try {
        await persistProgress();

        await submitExamSession(sessionId, {
          answers: progressRef.current.answers,
          remainingSeconds: progressRef.current.timeRemaining,
          markedQuestions: progressRef.current.markedQuestions,
        });

        navigate(`/results/${sessionId}`, {
          replace: true,
          state: { autoSubmitted: autoSubmit },
        });
      } catch (submitError) {
        setError(submitError.message || t('common.error'));
      } finally {
        setSubmitting(false);
        setShowSubmitModal(false);
      }
    },
    [navigate, persistProgress, sessionId, submitting, t]
  );

  useEffect(() => {
    if (
      session?.mode === EXAM_MODES.TIMED &&
      timeRemaining === 0 &&
      session?.status !== 'completed' &&
      !autoSubmittedRef.current
    ) {
      autoSubmittedRef.current = true;
      void finalizeExam(true);
    }
  }, [finalizeExam, session?.mode, session?.status, timeRemaining]);

  const totalQuestions = session?.questions?.length || 0;
  const answeredCount = useMemo(
    () => Object.keys(answers).filter((key) => answers[key] !== null && answers[key] !== undefined).length,
    [answers]
  );
  const unansweredCount = Math.max(totalQuestions - answeredCount, 0);
  const markedCount = markedQuestions.length;
  const currentQuestion = session?.questions?.[currentIndex];
  const selectedAnswer = currentQuestion
    ? Object.prototype.hasOwnProperty.call(answers, currentQuestion.id)
      ? Number(answers[currentQuestion.id])
      : null
    : null;
  const isPracticeMode = session?.mode === EXAM_MODES.PRACTICE;
  const isMarked = currentQuestion ? markedQuestions.includes(currentQuestion.id) : false;

  const saveMessage =
    saveState === 'saving'
      ? t('exam.savingProgress')
      : saveState === 'error'
        ? t('exam.saveFailed')
        : lastSavedAt
          ? `${t('exam.savedAt')} ${new Date(lastSavedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : t('exam.autoSaveActive');

  const handleAnswerSelect = (optionIndex) => {
    if (!currentQuestion) return;

    const nextAnswers = {
      ...answers,
      [currentQuestion.id]: optionIndex,
    };

    setAnswers(nextAnswers);
    void persistProgress({ answers: nextAnswers });
  };

  const handleClearAnswer = () => {
    if (!currentQuestion) return;

    const nextAnswers = { ...answers };
    delete nextAnswers[currentQuestion.id];

    setAnswers(nextAnswers);
    void persistProgress({ answers: nextAnswers });
  };

  const handleToggleMark = () => {
    if (!currentQuestion) return;

    const nextMarkedQuestions = isMarked
      ? markedQuestions.filter((questionId) => questionId !== currentQuestion.id)
      : [...markedQuestions, currentQuestion.id];

    setMarkedQuestions(nextMarkedQuestions);
    void persistProgress({ markedQuestions: nextMarkedQuestions });
  };

  const handleQuestionNavigation = (targetIndex) => {
    setCurrentIndex(targetIndex);
    void persistProgress({ currentIndex: targetIndex });
  };

  if (loading) {
    return <Loader fullPage />;
  }

  if (error && !session) {
    return (
      <div className="card exam-empty">
        <h1 className="page-title">{t('exam.setup')}</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
      </div>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <div className="card exam-empty">
        <p>{t('exam.noQuestionsDescription')}</p>
      </div>
    );
  }

  return (
    <div className="exam-page">
      <div className="card exam-page-header">
        <div>
          <h1 className="page-title" style={{ marginBottom: 8 }}>
            {session.mode === EXAM_MODES.TIMED ? t('exam.timed') : t('exam.practice')}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {t('exam.question')} {currentIndex + 1} {t('exam.of')} {totalQuestions}
          </p>
        </div>

        <div className="exam-status-bar">
          <span className="badge badge-primary">
            <CheckCircle2 size={14} />
            {answeredCount}/{totalQuestions}
          </span>
          <span className={`badge ${markedCount > 0 ? 'badge-warning' : 'badge-secondary'}`}>
            <BookmarkCheck size={14} />
            {markedCount}
          </span>
          {session.mode === EXAM_MODES.TIMED ? (
            <span className="badge badge-warning exam-timer">
              <Timer size={14} />
              {formatTime(timeRemaining)}
            </span>
          ) : (
            <span className="badge badge-success">
              <Clock3 size={14} />
              {t('exam.practice')}
            </span>
          )}
        </div>
      </div>

      <ProgressBar value={answeredCount} max={totalQuestions} showLabel />

      <div className={`exam-save-status ${saveState === 'error' ? 'error' : ''}`}>
        <Save size={14} />
        <span>{saveMessage}</span>
      </div>

      {error && (
        <div className="setup-banner setup-banner-error">
          <span>{error}</span>
        </div>
      )}

      <div className="grid-2 exam-shell">
        <section className="card exam-main-card">
          <div className="exam-topline">
            <div className="question-preview-meta">
              <span className="badge badge-warning">{t(`exam.${currentQuestion.difficulty}`)}</span>
              <span className="badge badge-success">{t(`exam.${currentQuestion.category}`)}</span>
              {isMarked && <span className="badge badge-primary">{t('exam.markedForReview')}</span>}
            </div>
            <span className="badge badge-primary">
              {t('exam.question')} {currentIndex + 1}
            </span>
          </div>

          <h2 className="exam-question-text">{currentQuestion.text}</h2>

          <div className="exam-options">
            {currentQuestion.options.map((option, optionIndex) => (
              <button
                type="button"
                key={`${currentQuestion.id}-${optionIndex}`}
                className={`exam-option-btn ${selectedAnswer === optionIndex ? 'selected' : ''}`}
                onClick={() => handleAnswerSelect(optionIndex)}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="exam-quick-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleToggleMark}>
              <BookmarkCheck size={15} />
              {isMarked ? t('exam.unmarkReview') : t('exam.markForReview')}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearAnswer}
              disabled={selectedAnswer === null || selectedAnswer === undefined}
            >
              <RotateCcw size={15} />
              {t('exam.clearAnswer')}
            </button>
          </div>

          {isPracticeMode && selectedAnswer !== undefined && selectedAnswer !== null && (
            <div className="exam-explanation">
              <p>
                <strong>
                  {selectedAnswer === currentQuestion.correctAnswer ? t('exam.correct') : t('exam.incorrect')}
                </strong>
              </p>
              <p>
                <strong>{t('exam.explanation')}:</strong> {currentQuestion.explanation || '-'}
              </p>
            </div>
          )}

          <div className="exam-footer">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleQuestionNavigation(Math.max(currentIndex - 1, 0))}
                disabled={currentIndex === 0}
              >
                {t('exam.previous')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleQuestionNavigation(Math.min(currentIndex + 1, totalQuestions - 1))}
                disabled={currentIndex === totalQuestions - 1}
              >
                {t('exam.next')}
              </button>
            </div>

            <button type="button" className="btn btn-danger" onClick={() => setShowSubmitModal(true)}>
              <Flag size={16} />
              {t('exam.submit')}
            </button>
          </div>
        </section>

        <aside className="card">
          <h2 style={{ marginBottom: 8 }}>{t('exam.questionNavigator')}</h2>
          <div className="exam-sidebar-summary">
            <div>
              <strong>{answeredCount}</strong>
              <span>{t('exam.answeredCount')}</span>
            </div>
            <div>
              <strong>{unansweredCount}</strong>
              <span>{t('exam.unansweredCount')}</span>
            </div>
            <div>
              <strong>{markedCount}</strong>
              <span>{t('exam.markedForReview')}</span>
            </div>
          </div>

          {session.mode === EXAM_MODES.TIMED && timeRemaining <= 60 && (
            <div className="exam-warning-banner">
              <AlertTriangle size={16} />
              <span>{t('exam.timeAlmostDone')}</span>
            </div>
          )}

          <div className="exam-question-grid">
            {session.questions.map((question, index) => {
              const isAnswered = answers[question.id] !== undefined && answers[question.id] !== null;
              const isQuestionMarked = markedQuestions.includes(question.id);

              return (
                <button
                  type="button"
                  key={question.id}
                  className={`exam-grid-btn ${index === currentIndex ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${isQuestionMarked ? 'marked' : ''}`}
                  onClick={() => handleQuestionNavigation(index)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title={t('exam.submit')}
      >
        <p style={{ marginBottom: 12 }}>{t('exam.confirmSubmit')}</p>
        {unansweredCount > 0 && (
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            {t('exam.unansweredWarning', { count: unansweredCount })}
          </p>
        )}
        {markedCount > 0 && (
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            {t('exam.markedWarning', { count: markedCount })}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-danger" onClick={() => void finalizeExam(false)}>
            {submitting ? t('common.loading') : t('exam.submit')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>
            {t('common.cancel')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
