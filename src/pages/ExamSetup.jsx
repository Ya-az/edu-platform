import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Layers3, ListFilter, PlayCircle, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Loader from '../components/common/Loader';
import { useAuth } from '../hooks/useAuth';
import { useQuestions } from '../hooks/useQuestions';
import { createExamSession, getActiveExamSession } from '../services/examSessionService';
import {
  CATEGORIES,
  DEFAULT_EXAM_SETTINGS,
  DIFFICULTY,
  EXAM_MODES,
  QUESTION_COUNT_OPTIONS,
} from '../utils/constants';
import './ExamSetup.css';

export default function ExamSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [resumableSession, setResumableSession] = useState(null);

  const initialMode = searchParams.get('mode') === EXAM_MODES.TIMED ? EXAM_MODES.TIMED : DEFAULT_EXAM_SETTINGS.mode;

  const { questions, stats, loading, error, filters, updateFilter, refresh, meta } = useQuestions({
    mode: initialMode,
    timerMinutes: DEFAULT_EXAM_SETTINGS.timerMinutes,
    limit: DEFAULT_EXAM_SETTINGS.questionCount,
  });

  const previewQuestions = useMemo(() => questions.slice(0, 6), [questions]);
  const categorySummary = `${stats?.byCategory?.[CATEGORIES.QUANTITATIVE] || 0} ${t('exam.quantitative')} • ${stats?.byCategory?.[CATEGORIES.VERBAL] || 0} ${t('exam.verbal')}`;
  const difficultySummary = `${stats?.byDifficulty?.[DIFFICULTY.EASY] || 0} ${t('exam.easy')} • ${stats?.byDifficulty?.[DIFFICULTY.MEDIUM] || 0} ${t('exam.medium')} • ${stats?.byDifficulty?.[DIFFICULTY.HARD] || 0} ${t('exam.hard')}`;
  const selectedMode = filters.mode || initialMode;

  useEffect(() => {
    let isMounted = true;

    const loadActiveSession = async () => {
      if (!user?.uid) {
        if (isMounted) {
          setResumableSession(null);
        }
        return;
      }

      try {
        const activeSession = await getActiveExamSession(user.uid);

        if (isMounted) {
          setResumableSession(activeSession);
        }
      } catch {
        if (isMounted) {
          setResumableSession(null);
        }
      }
    };

    void loadActiveSession();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const handleStartExam = async () => {
    setStarting(true);
    setActionError('');

    try {
      const sessionId = await createExamSession({
        userId: user?.uid,
        mode: selectedMode,
        category: filters.category,
        difficulty: filters.difficulty,
        questionCount: Number(filters.limit),
        timerMinutes: Number(filters.timerMinutes || DEFAULT_EXAM_SETTINGS.timerMinutes),
      });

      navigate(`/exam/${sessionId}`);
    } catch (startError) {
      setActionError(startError.message || t('common.error'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="exam-setup-page">
      <div className="exam-setup-header">
        <div>
          <h1 className="page-title">{t('exam.setup')}</h1>
          <p className="setup-subtitle">{t('exam.bankDescription')}</p>
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={refresh}>
          <RefreshCcw size={16} />
          {t('common.retry')}
        </button>
      </div>

      {meta.source === 'demo' && (
        <div className="setup-banner setup-banner-warning">
          <AlertCircle size={18} />
          <span>{t('exam.demoModeNotice')}</span>
        </div>
      )}

      {(error || actionError) && (
        <div className="setup-banner setup-banner-error">
          <AlertCircle size={18} />
          <span>{error || actionError}</span>
        </div>
      )}

      {resumableSession && (
        <div className="setup-banner">
          <AlertCircle size={18} />
          <span>
            {t('exam.resumeAvailable')} — {t('exam.answeredCount')}: {Object.keys(resumableSession.answers || {}).length}/
            {resumableSession.questions?.length || 0}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/exam/${resumableSession.id}`)}
          >
            {t('exam.resumeExam')}
          </button>
        </div>
      )}

      <div className="grid-4 setup-stats">
        <div className="card">
          <span className="stat-label">{t('exam.availableQuestions')}</span>
          <div className="stat-value">{meta.totalAvailable}</div>
          <p className="stat-footnote">{t('exam.questionBankReady')}</p>
        </div>

        <div className="card">
          <span className="stat-label">{t('exam.filteredQuestions')}</span>
          <div className="stat-value">{meta.filteredCount}</div>
          <p className="stat-footnote">{t('exam.previewSubtitle')}</p>
        </div>

        <div className="card">
          <span className="stat-label">{t('exam.categoryCoverage')}</span>
          <div className="stat-value">2</div>
          <p className="stat-footnote">{categorySummary}</p>
        </div>

        <div className="card">
          <span className="stat-label">{t('exam.difficultyMix')}</span>
          <div className="stat-value">3</div>
          <p className="stat-footnote">{difficultySummary}</p>
        </div>
      </div>

      <div className="grid-2 setup-grid">
        <section className="card">
          <div className="setup-section-title">
            <ListFilter size={18} />
            <h2>{t('nav.questionBank')}</h2>
          </div>

          <div className="form-group">
            <label className="form-label">{t('exam.mode')}</label>
            <select
              className="form-select"
              value={selectedMode}
              onChange={(event) => updateFilter('mode', event.target.value)}
            >
              <option value={EXAM_MODES.PRACTICE}>{t('exam.practice')}</option>
              <option value={EXAM_MODES.TIMED}>{t('exam.timed')}</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('exam.category')}</label>
            <select
              className="form-select"
              value={filters.category}
              onChange={(event) => updateFilter('category', event.target.value)}
            >
              <option value={CATEGORIES.BOTH}>{t('exam.both')}</option>
              <option value={CATEGORIES.QUANTITATIVE}>{t('exam.quantitative')}</option>
              <option value={CATEGORIES.VERBAL}>{t('exam.verbal')}</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('exam.difficulty')}</label>
            <select
              className="form-select"
              value={filters.difficulty}
              onChange={(event) => updateFilter('difficulty', event.target.value)}
            >
              <option value={DIFFICULTY.ALL}>{t('exam.all')}</option>
              <option value={DIFFICULTY.EASY}>{t('exam.easy')}</option>
              <option value={DIFFICULTY.MEDIUM}>{t('exam.medium')}</option>
              <option value={DIFFICULTY.HARD}>{t('exam.hard')}</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('exam.questionCount')}</label>
            <select
              className="form-select"
              value={filters.limit}
              onChange={(event) => updateFilter('limit', Number(event.target.value))}
            >
              {QUESTION_COUNT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>

          {selectedMode === EXAM_MODES.TIMED && (
            <div className="form-group">
              <label className="form-label">{t('exam.timerMinutes')}</label>
              <input
                type="number"
                min="5"
                max="180"
                className="form-input"
                value={filters.timerMinutes}
                onChange={(event) => updateFilter('timerMinutes', Number(event.target.value))}
              />
            </div>
          )}

          <div className="setup-note">
            <p>
              <strong>{t('exam.filteredQuestions')}:</strong> {meta.filteredCount}
            </p>
            <p>
              <strong>{t('exam.questionCount')}:</strong> {Math.min(Number(filters.limit || 0), meta.filteredCount)}
            </p>
            <p>{t('exam.nextStepHint')}</p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartExam}
            disabled={loading || starting || meta.filteredCount === 0}
          >
            <PlayCircle size={18} />
            {starting ? t('common.loading') : t('exam.start')}
          </button>
        </section>

        <section className="card">
          <div className="setup-section-title">
            <Layers3 size={18} />
            <h2>{t('exam.bankReadiness')}</h2>
          </div>

          <ul className="readiness-list">
            <li>
              <span className="readiness-label">{t('exam.availableQuestions')}</span>
              <span className="readiness-value">{meta.totalAvailable}</span>
            </li>
            <li>
              <span className="readiness-label">{t('exam.categoryCoverage')}</span>
              <span className="readiness-value">{categorySummary}</span>
            </li>
            <li>
              <span className="readiness-label">{t('exam.difficultyMix')}</span>
              <span className="readiness-value">{difficultySummary}</span>
            </li>
            <li>
              <span className="readiness-label">{t('exam.mode')}</span>
              <span className="badge badge-primary">
                {selectedMode === EXAM_MODES.TIMED ? t('exam.timed') : t('exam.practice')}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="question-bank-header">
          <div>
            <h2>{t('nav.questionBank')}</h2>
            <p>{t('exam.previewSubtitle')}</p>
          </div>

          <span className="badge badge-primary">
            <BookOpen size={14} />
            {meta.filteredCount}
          </span>
        </div>

        {loading ? (
          <Loader />
        ) : previewQuestions.length === 0 ? (
          <div className="question-empty-state">
            <h3>{t('exam.noQuestionsTitle')}</h3>
            <p>{t('exam.noQuestionsDescription')}</p>
          </div>
        ) : (
          <div className="question-preview-list">
            {previewQuestions.map((question, index) => (
              <article key={question.id} className="question-preview-card">
                <div className="question-preview-meta">
                  <span className="badge badge-primary">
                    {t('exam.question')} {index + 1}
                  </span>
                  <span className="badge badge-warning">{t(`exam.${question.difficulty}`)}</span>
                  <span className="badge badge-success">{t(`exam.${question.category}`)}</span>
                </div>

                <h3 className="question-preview-title">{question.text}</h3>

                <div className="question-options">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={`${question.id}-${optionIndex}`}
                      className={`question-option ${question.correctAnswer === optionIndex ? 'correct' : ''}`}
                    >
                      {option}
                    </div>
                  ))}
                </div>

                {question.explanation && (
                  <p className="question-explanation">
                    <strong>{t('exam.explanation')}:</strong> {question.explanation}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
