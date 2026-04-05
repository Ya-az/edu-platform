import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import Loader from '../components/common/Loader';
import ProgressBar from '../components/common/ProgressBar';
import { getExamSessionById } from '../services/examSessionService';
import { formatTime, getScoreColor } from '../utils/helpers';
import './Results.css';

function getPerformanceSummary(score, t) {
  if (score >= 85) return t('results.performanceExcellent');
  if (score >= 70) return t('results.performanceGood');
  if (score >= 50) return t('results.performanceAverage');
  return t('results.performanceNeedsFocus');
}

export default function Results() {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;

    const loadResults = async () => {
      setLoading(true);
      setError('');

      try {
        const examSession = await getExamSessionById(sessionId);

        if (!examSession || examSession.status !== 'completed') {
          throw new Error(t('results.sessionUnavailable'));
        }

        if (isMounted) {
          setSession(examSession);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || t('common.error'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadResults();

    return () => {
      isMounted = false;
    };
  }, [sessionId, t]);

  const reviewItems = useMemo(() => {
    if (!session) return [];

    if (Array.isArray(session.reviewItems) && session.reviewItems.length > 0) {
      return session.reviewItems;
    }

    return session.questions.map((question) => {
      const hasAnswer = Object.prototype.hasOwnProperty.call(session.answers || {}, question.id);
      const selectedAnswer = hasAnswer ? Number(session.answers[question.id]) : null;

      return {
        ...question,
        selectedAnswer,
        isAnswered: hasAnswer,
        isCorrect: selectedAnswer === question.correctAnswer,
      };
    });
  }, [session]);

  const filteredReviewItems = useMemo(() => {
    switch (reviewFilter) {
      case 'incorrect':
        return reviewItems.filter((item) => !item.isCorrect && item.isAnswered);
      case 'skipped':
        return reviewItems.filter((item) => !item.isAnswered);
      default:
        return reviewItems;
    }
  }, [reviewFilter, reviewItems]);

  if (loading) {
    return <Loader fullPage />;
  }

  if (error || !session) {
    return (
      <div className="card results-page">
        <h1 className="page-title">{t('results.title')}</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
        <div className="results-actions">
          <Link to="/exam/setup" className="btn btn-primary">
            {t('home.startPractice')}
          </Link>
        </div>
      </div>
    );
  }

  const scoreColor = getScoreColor(session.score || 0);
  const scoreAngle = Math.round(((session.score || 0) / 100) * 360);
  const sectionEntries = Object.entries(session.sectionScores || {});
  const strongestSection = [...sectionEntries].sort((a, b) => (b[1]?.score || 0) - (a[1]?.score || 0))[0];
  const weakestSection = [...sectionEntries].sort((a, b) => (a[1]?.score || 0) - (b[1]?.score || 0))[0];

  return (
    <div className="results-page">
      <section className="card results-hero">
        <div>
          <h1 className="page-title">{t('results.title')}</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            {location.state?.autoSubmitted ? t('results.autoSubmitted') : t('results.reviewAnswers')}
          </p>
          <p className="results-summary-note">{getPerformanceSummary(session.score || 0, t)}</p>
          <ProgressBar value={session.score || 0} max={100} color={scoreColor} showLabel />
        </div>

        <div
          className="results-score-ring"
          style={{
            background: `radial-gradient(circle, var(--color-bg-secondary) 35%, transparent 36%), conic-gradient(${scoreColor} ${scoreAngle}deg, rgba(109, 93, 252, 0.14) ${scoreAngle}deg 360deg)`,
          }}
        >
          {session.score || 0}%
        </div>
      </section>

      <div className="grid-4 results-summary-grid">
        <div className="card">
          <span className="results-stat-label">{t('results.score')}</span>
          <div className="results-stat-value">{session.score || 0}%</div>
        </div>
        <div className="card">
          <span className="results-stat-label">{t('results.correctAnswers')}</span>
          <div className="results-stat-value">{session.correctAnswers || 0}</div>
        </div>
        <div className="card">
          <span className="results-stat-label">{t('results.wrongAnswers')}</span>
          <div className="results-stat-value">{session.wrongAnswers || 0}</div>
        </div>
        <div className="card">
          <span className="results-stat-label">{t('results.skippedAnswers')}</span>
          <div className="results-stat-value">{session.skipped || 0}</div>
        </div>
        <div className="card">
          <span className="results-stat-label">{t('results.timeTaken')}</span>
          <div className="results-stat-value">
            {session.timeTakenSeconds !== null && session.timeTakenSeconds !== undefined
              ? formatTime(session.timeTakenSeconds)
              : '--'}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 style={{ marginBottom: 14 }}>{t('results.sectionBreakdown')}</h2>
          <div className="results-section-grid">
            {sectionEntries.map(([sectionKey, sectionValue]) => (
              <div key={sectionKey} className="results-section-card">
                <div className="results-section-head">
                  <span className="results-stat-label">{t(`exam.${sectionKey}`)}</span>
                  <strong>{sectionValue.score || 0}%</strong>
                </div>
                <ProgressBar value={sectionValue.score || 0} max={100} color={getScoreColor(sectionValue.score || 0)} />
                <p className="results-section-note">
                  {sectionValue.correct || 0} / {sectionValue.total || 0}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginBottom: 14 }}>{t('results.performanceSummary')}</h2>
          <div className="results-insight-list">
            <div className="results-insight-item">
              <span>{t('results.accuracy')}</span>
              <strong>{session.accuracy || 0}%</strong>
            </div>
            <div className="results-insight-item">
              <span>{t('results.completionRate')}</span>
              <strong>{session.completionRate || 0}%</strong>
            </div>
            {strongestSection && (
              <div className="results-insight-item">
                <span>{t('results.strongestSection')}</span>
                <strong>{t(`exam.${strongestSection[0]}`)}</strong>
              </div>
            )}
            {weakestSection && (
              <div className="results-insight-item">
                <span>{t('results.improvementArea')}</span>
                <strong>{t(`exam.${weakestSection[0]}`)}</strong>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="results-review-header">
          <div>
            <h2>{t('results.reviewAnswers')}</h2>
            <p className="results-review-count">
              {t('results.reviewCount', { count: filteredReviewItems.length })}
            </p>
          </div>

          <div className="results-filter-row">
            <button
              type="button"
              className={`results-filter-btn ${reviewFilter === 'all' ? 'active' : ''}`}
              onClick={() => setReviewFilter('all')}
            >
              {t('results.filterAll')}
            </button>
            <button
              type="button"
              className={`results-filter-btn ${reviewFilter === 'incorrect' ? 'active' : ''}`}
              onClick={() => setReviewFilter('incorrect')}
            >
              {t('results.filterIncorrect')}
            </button>
            <button
              type="button"
              className={`results-filter-btn ${reviewFilter === 'skipped' ? 'active' : ''}`}
              onClick={() => setReviewFilter('skipped')}
            >
              {t('results.filterSkipped')}
            </button>
          </div>
        </div>

        <div className="results-review-list">
          {filteredReviewItems.map((item, index) => (
            <article key={item.id} className="results-review-card">
              <div className="question-preview-meta" style={{ marginBottom: 10 }}>
                <span className="badge badge-primary">
                  {t('exam.question')} {index + 1}
                </span>
                <span className={`badge ${item.isCorrect ? 'badge-success' : 'badge-error'}`}>
                  {item.isCorrect ? t('exam.correct') : item.isAnswered ? t('exam.incorrect') : t('exam.notAnswered')}
                </span>
                {item.isMarked && <span className="badge badge-warning">{t('exam.markedForReview')}</span>}
              </div>

              <h3 className="results-review-title">{item.text}</h3>

              <div className="results-options">
                {item.options.map((option, optionIndex) => {
                  const isCorrectOption = optionIndex === item.correctAnswer;
                  const isWrongSelected = item.selectedAnswer === optionIndex && !item.isCorrect;

                  return (
                    <div
                      key={`${item.id}-${optionIndex}`}
                      className={`results-option ${isCorrectOption ? 'correct' : ''} ${isWrongSelected ? 'wrong' : ''}`}
                    >
                      {option}
                    </div>
                  );
                })}
              </div>

              <p className="results-answer-line">
                <strong>{t('results.yourAnswer')}:</strong>{' '}
                {item.selectedAnswer !== null && item.selectedAnswer !== undefined
                  ? item.options[item.selectedAnswer]
                  : t('exam.notAnswered')}
              </p>
              <p className="results-answer-line">
                <strong>{t('results.correctAnswerLabel')}:</strong> {item.options[item.correctAnswer] || '-'}
              </p>

              {item.explanation && (
                <p className="results-explanation">
                  <strong>{t('exam.explanation')}:</strong> {item.explanation}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="results-actions">
        <Link to="/exam/setup" className="btn btn-primary">
          {t('results.tryAgain')}
        </Link>
        <Link to="/analytics" className="btn btn-secondary">
          {t('analytics.title')}
        </Link>
        <Link to="/dashboard" className="btn btn-secondary">
          {t('results.backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
