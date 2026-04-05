import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import {
  Home,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  LogIn,
  Sun,
  Moon,
  Globe,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import './Navbar.css';

export default function Navbar() {
  const { t } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navLinks = [
    { to: '/', label: t('nav.home'), icon: <Home size={18} /> },
    ...(user
      ? [
          { to: '/dashboard', label: t('nav.dashboard'), icon: <FileText size={18} /> },
          { to: '/analytics', label: t('nav.analytics'), icon: <BarChart3 size={18} /> },
        ]
      : []),
    ...(isAdmin
      ? [{ to: '/admin', label: t('nav.admin'), icon: <Settings size={18} /> }]
      : []),
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container container">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">📝</span>
          <span className="logo-text">{t('app.name')}</span>
        </Link>

        {/* Desktop Navigation */}
        <div className={`navbar-links ${mobileOpen ? 'open' : ''}`}>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          ))}
        </div>

        {/* Right side controls */}
        <div className="navbar-actions">
          <button className="btn-ghost nav-action-btn" onClick={toggleLanguage} title={t('common.language')}>
            <Globe size={18} />
            <span className="action-label">{language === 'ar' ? 'EN' : 'ع'}</span>
          </button>

          <button className="btn-ghost nav-action-btn" onClick={toggleTheme} title={isDark ? t('common.lightMode') : t('common.darkMode')}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <div className="nav-user">
              <img
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=6c5ce7&color=fff`}
                alt={user.displayName}
                className="nav-avatar"
              />
              <button className="btn-ghost nav-action-btn" onClick={handleLogout} title={t('nav.logout')}>
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              <LogIn size={16} />
              <span>{t('nav.login')}</span>
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </nav>
  );
}
