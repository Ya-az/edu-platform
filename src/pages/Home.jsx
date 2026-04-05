import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { BookOpen, Clock, BarChart3, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import './Home.css';

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const features = [
    {
      icon: <BookOpen size={32} />,
      title: t('home.practiceMode'),
      desc: t('home.practiceDesc'),
      color: 'var(--color-primary)',
    },
    {
      icon: <Clock size={32} />,
      title: t('home.examMode'),
      desc: t('home.examDesc'),
      color: 'var(--color-success)',
    },
    {
      icon: <BarChart3 size={32} />,
      title: t('home.analyticsFeature'),
      desc: t('home.analyticsDesc'),
      color: 'var(--color-warning)',
    },
  ];

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <h1 className="hero-title">{t('home.heroTitle')}</h1>
        <p className="hero-subtitle">{t('home.heroSubtitle')}</p>
        <div className="hero-actions">
          <Link to={user ? '/exam/setup?mode=practice' : '/login'} className="btn btn-primary btn-lg">
            {t('home.startPractice')}
            <Arrow size={18} />
          </Link>
          <Link to={user ? '/exam/setup?mode=timed' : '/login'} className="btn btn-secondary btn-lg">
            {t('home.startExam')}
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">{t('home.features')}</h2>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div className="feature-card card" key={index}>
              <div className="feature-icon" style={{ color: feature.color }}>
                {feature.icon}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
