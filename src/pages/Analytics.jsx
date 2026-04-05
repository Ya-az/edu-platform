import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Loader from '../components/common/Loader';
import { useAuth } from '../hooks/useAuth';
import { getUserAnalytics } from '../services/examSessionService';
import './Analytics.css';

export default function Analytics() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      setLoading(true);
      setError('');

      try {
        const analyticsData = await getUserAnalytics(user?.uid);

        if (isMounted) {
          setAnalytics(analyticsData);
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

    void loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [t, user?.uid]);

  if (loading) {
    return <Loader fullPage />;
  }

  if (error) {
    return (
      <div className="card analytics-page">
        <h1 className="page-title">{t('analytics.title')}</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
      </div>
    );
  }

  if (!analytics || analytics.totalExams === 0) {
    return (
      <div className="card analytics-empty">
        <h1 className="page-title">{t('analytics.title')}</h1>
        <p>{t('analytics.noData')}</p>
        <Link to="/exam/setup" className="btn btn-primary">
          {t('home.startPractice')}
        </Link>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div>
        <h1 className="page-title">{t('analytics.title')}</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>{t('analytics.progressOverTime')}</p>
      </div>

      <div className="grid-4 analytics-summary-grid">
        <div className="card">
          <span className="analytics-stat-label">{t('analytics.totalExams')}</span>
          <div className="analytics-stat-value">{analytics.totalExams}</div>
        </div>
        <div className="card">
          <span className="analytics-stat-label">{t('analytics.avgScore')}</span>
          <div className="analytics-stat-value">{analytics.avgScore}%</div>
        </div>
        <div className="card">
          <span className="analytics-stat-label">{t('analytics.bestScore')}</span>
          <div className="analytics-stat-value">{analytics.bestScore}%</div>
        </div>
        <div className="card">
          <span className="analytics-stat-label">{t('analytics.improvement')}</span>
          <div className="analytics-stat-value">
            {analytics.scoreImprovement > 0 ? '+' : ''}
            {analytics.scoreImprovement}%
          </div>
        </div>
        <div className="card">
          <span className="analytics-stat-label">{t('analytics.completionRate')}</span>
          <div className="analytics-stat-value">{analytics.completionRate}%</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card analytics-chart-card">
          <h2>{t('analytics.progressOverTime')}</h2>
          <div className="analytics-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.recentScores}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" stroke="var(--color-text-secondary)" />
                <YAxis domain={[0, 100]} stroke="var(--color-text-secondary)" />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card analytics-chart-card">
          <h2>{t('analytics.sectionAnalysis')}</h2>
          <div className="analytics-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.sectionPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis
                  dataKey="name"
                  stroke="var(--color-text-secondary)"
                  tickFormatter={(value) => t(`exam.${value}`)}
                />
                <YAxis domain={[0, 100]} stroke="var(--color-text-secondary)" />
                <Tooltip formatter={(value) => [`${value}%`, t('analytics.avgScore')]} />
                <Bar dataKey="score" fill="var(--color-success)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="card analytics-chart-card">
          <h2>{t('analytics.modeBreakdown')}</h2>
          <div className="analytics-list">
            {analytics.modeBreakdown.map((item) => (
              <div key={item.name} className="analytics-list-item">
                <span>
                  {item.name === 'timed' ? t('exam.timed') : t('exam.practice')} • {item.count} {t('analytics.sessions')}
                </span>
                <span className="badge badge-primary">{item.avgScore}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card analytics-chart-card">
          <h2>{t('analytics.recentActivity')}</h2>
          <div className="analytics-list">
            {analytics.recentActivity.map((item) => (
              <div key={item.id} className="analytics-list-item">
                <span>
                  {item.label} • {item.mode === 'timed' ? t('exam.timed') : t('exam.practice')} • {item.questionCount} {t('exam.questionCount')}
                </span>
                <span className={`badge ${item.score >= 70 ? 'badge-success' : 'badge-warning'}`}>{item.score}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="card analytics-chart-card">
          <h2>{t('analytics.weakAreas')}</h2>
          <div className="analytics-list">
            {analytics.weakAreas.length > 0 ? (
              analytics.weakAreas.map((item) => (
                <div key={item.name} className="analytics-list-item">
                  <span>{t(`exam.${item.name}`)}</span>
                  <span className="badge badge-warning">{item.score}%</span>
                </div>
              ))
            ) : (
              <div className="analytics-list-item">
                <span>{t('analytics.noWeakAreas')}</span>
                <span className="badge badge-success">100%</span>
              </div>
            )}
          </div>
        </section>

        <section className="card analytics-chart-card">
          <h2>{t('analytics.suggestedPractice')}</h2>
          <div className="analytics-list">
            {analytics.suggestions.length > 0 ? (
              analytics.suggestions.map((item) => (
                <div key={item.category} className="analytics-list-item analytics-list-item-wrap">
                  <span>
                    {t('analytics.practiceRecommendation', { section: t(`exam.${item.category}`) })}
                    {` • ${item.targetQuestions} ${t('exam.questionCount')}`}
                  </span>
                  <span className="badge badge-primary">{item.score}%</span>
                </div>
              ))
            ) : (
              <div className="analytics-list-item">
                <span>{t('analytics.keepGoing')}</span>
                <span className="badge badge-success">✓</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
