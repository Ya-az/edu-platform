import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, BarChart3, Crown } from 'lucide-react';
import './StudentDashboard.css';

export default function StudentDashboard() {
  const { t } = useTranslation();
  const { user, isPremium } = useAuth();

  return (
    <div className="dashboard">
      {/* Welcome header */}
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1 className="page-title">
            {t('auth.welcome')}، {user?.displayName}
          </h1>
          <span className={`badge ${isPremium ? 'badge-primary' : 'badge-warning'}`}>
            {isPremium ? t('subscription.premium') : t('subscription.free')}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="dashboard-grid grid-3">
        <Link to="/exam/setup?mode=practice" className="dashboard-card card">
          <div className="dc-icon" style={{ color: 'var(--color-primary)' }}>
            <BookOpen size={28} />
          </div>
          <h3 className="dc-title">{t('home.startPractice')}</h3>
          <p className="dc-desc">{t('home.practiceDesc')}</p>
        </Link>

        <Link to="/exam/setup?mode=timed" className="dashboard-card card">
          <div className="dc-icon" style={{ color: 'var(--color-success)' }}>
            <Clock size={28} />
          </div>
          <h3 className="dc-title">{t('home.startExam')}</h3>
          <p className="dc-desc">{t('home.examDesc')}</p>
        </Link>

        <Link to="/analytics" className="dashboard-card card">
          <div className="dc-icon" style={{ color: 'var(--color-warning)' }}>
            <BarChart3 size={28} />
          </div>
          <h3 className="dc-title">{t('analytics.title')}</h3>
          <p className="dc-desc">{t('home.analyticsDesc')}</p>
        </Link>
      </div>

      {/* Upgrade banner for free users */}
      {!isPremium && (
        <div className="upgrade-banner card">
          <Crown size={24} className="upgrade-icon" />
          <div className="upgrade-text">
            <h3>{t('subscription.upgrade')}</h3>
            <p>{t('subscription.unlimitedExams')} • {t('subscription.detailedAnalytics')}</p>
          </div>
          <button className="btn btn-primary">{t('subscription.upgrade')}</button>
        </div>
      )}
    </div>
  );
}
