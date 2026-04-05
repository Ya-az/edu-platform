import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, UserX, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import './Login.css';

// Tab views: 'email-login' | 'email-register' | 'phone'
const GOOGLE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function Login() {
  const { t } = useTranslation();
  const {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendPhoneOTP,
    verifyPhoneOTP,
    loginAsGuest,
    user,
    isDemoMode,
    isAdmin,
    demoAdminEmail,
    demoAdminPassword,
  } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('email-login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Email form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone form
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(isAdmin ? '/admin' : '/dashboard');
    }
  }, [user, isAdmin, navigate]);

  const clearError = () => setError('');

  const getAuthErrorMessage = (err, fallbackMessage) => {
    if (err?.code === 'auth/invalid-credential') {
      return t('auth.invalidCredentials');
    }

    if (err?.code === 'auth/email-already-in-use') {
      return t('auth.emailAlreadyInUse');
    }

    if (err?.code === 'auth/invalid-api-key') {
      return t('auth.firebaseNotConfigured');
    }

    return err?.message || fallbackMessage;
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setError('');
  };

  // Google login
  const handleGoogleLogin = async () => {
    setLoading(true);
    clearError();
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.loginError')));
      console.error('Google login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Email login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.loginError')));
      console.error('Email login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Email register
  const handleEmailRegister = async (e) => {
    e.preventDefault();
    clearError();

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail(email, password, displayName);
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.registerError')));
      console.error('Register error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Phone - send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    clearError();

    if (phoneNumber.length < 10) {
      setError(t('auth.invalidPhone'));
      return;
    }

    setLoading(true);
    try {
      const result = await sendPhoneOTP(phoneNumber, 'recaptcha-container');
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.loginError')));
      console.error('Phone OTP error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Phone - verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    try {
      await verifyPhoneOTP(confirmationResult, otpCode);
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.loginError')));
      console.error('OTP verify error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Guest login
  const handleGuestLogin = async () => {
    setLoading(true);
    clearError();
    try {
      await loginAsGuest();
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.loginError')));
      console.error('Guest login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        {/* Header */}
        <div className="login-header">
          <span className="login-icon">📝</span>
          <h1 className="login-title">{t('auth.loginTitle')}</h1>
          <p className="login-subtitle">{t('auth.loginSubtitle')}</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        {isDemoMode && (
          <div className="login-info">
            <p>{t('auth.demoModeNotice')}</p>
            <p>
              <strong>{t('auth.adminQuickAccess')}:</strong>{' '}
              <span dir="ltr">{demoAdminEmail} / {demoAdminPassword}</span>
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab ${activeTab.startsWith('email') ? 'active' : ''}`}
            onClick={() => handleTabSwitch('email-login')}
          >
            <Mail size={16} />
            {t('auth.email')}
          </button>
          <button
            className={`login-tab ${activeTab === 'phone' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('phone')}
          >
            <Phone size={16} />
            {t('auth.phoneNumber')}
          </button>
        </div>

        {/* Email Login Form */}
        {activeTab === 'email-login' && (
          <form onSubmit={handleEmailLogin} className="login-form">
            <div className="form-group">
              <input
                type="email"
                className="form-input"
                placeholder={t('auth.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder={t('auth.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading}>
              {loading ? t('auth.loggingIn') : t('auth.loginWithEmail')}
            </button>
            <p className="login-switch">
              {t('auth.noAccount')}{' '}
              <button type="button" className="link-btn" onClick={() => handleTabSwitch('email-register')}>
                {t('auth.register')}
              </button>
            </p>
          </form>
        )}

        {/* Email Register Form */}
        {activeTab === 'email-register' && (
          <form onSubmit={handleEmailRegister} className="login-form">
            <div className="form-group">
              <input
                type="text"
                className="form-input"
                placeholder={t('auth.displayName')}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="email"
                className="form-input"
                placeholder={t('auth.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder={t('auth.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <input
                type="password"
                className="form-input"
                placeholder={t('auth.confirmPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading}>
              {loading ? t('auth.registering') : t('auth.register')}
            </button>
            <p className="login-switch">
              {t('auth.haveAccount')}{' '}
              <button type="button" className="link-btn" onClick={() => handleTabSwitch('email-login')}>
                {t('auth.loginTitle')}
              </button>
            </p>
          </form>
        )}

        {/* Phone OTP Form */}
        {activeTab === 'phone' && (
          <>
            {!otpSent ? (
              <form onSubmit={handleSendOTP} className="login-form">
                <div className="form-group">
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+966 5XXXXXXXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    dir="ltr"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading}>
                  {loading ? t('auth.loggingIn') : t('auth.sendOtp')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="login-form">
                <p className="otp-sent-msg">
                  {t('auth.otpSent', { phone: phoneNumber })}
                </p>
                {isDemoMode && <p className="guest-note">{t('auth.demoOtpHint')}</p>}
                <div className="form-group">
                  <input
                    type="text"
                    className="form-input otp-input"
                    placeholder="------"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    required
                    dir="ltr"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading}>
                  {loading ? t('auth.loggingIn') : t('auth.verifyOtp')}
                </button>
              </form>
            )}
          </>
        )}

        {/* Divider */}
        <div className="login-divider">
          <span>{t('auth.orContinueWith')}</span>
        </div>

        {/* Social / Alternative Logins */}
        <div className="alt-logins">
          <button className="social-btn google-btn" onClick={handleGoogleLogin} disabled={loading}>
            {GOOGLE_ICON}
            <span>Google</span>
          </button>

          <button className="social-btn guest-btn" onClick={handleGuestLogin} disabled={loading}>
            <UserX size={20} />
            <span>{t('auth.loginAsGuest')}</span>
          </button>
        </div>

        <p className="guest-note">{t('auth.guestNote')}</p>

        {/* reCAPTCHA container for phone auth */}
        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}
