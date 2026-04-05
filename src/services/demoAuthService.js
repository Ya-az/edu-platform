const DEMO_SESSION_KEY = 'edu-platform-demo-session';
const DEMO_ACCOUNTS_KEY = 'edu-platform-demo-accounts';
const DEMO_OTP_KEY = 'edu-platform-demo-otp';

export const DEMO_ADMIN_EMAIL = 'admin@eduplatform.com';
export const DEMO_ADMIN_PASSWORD = 'Admin@123456';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function isAdminDemoEmail(email = '') {
  return email.trim().toLowerCase() === DEMO_ADMIN_EMAIL;
}

function readJson(key, fallbackValue) {
  if (!canUseStorage()) return fallbackValue;

  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function removeItem(key) {
  if (!canUseStorage()) return;
  localStorage.removeItem(key);
}

function buildAvatarUrl(name = 'Demo User') {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6c5ce7&color=fff`;
}

function normalizeDemoUser(user = {}) {
  const displayName = user.displayName || user.email?.split('@')[0] || 'ضيف';
  const role = user.role || (isAdminDemoEmail(user.email || '') ? 'admin' : 'student');

  return {
    uid: user.uid || `demo-${Date.now()}`,
    email: user.email || null,
    displayName,
    photoURL: user.photoURL || buildAvatarUrl(displayName),
    phoneNumber: user.phoneNumber || null,
    isAnonymous: Boolean(user.isAnonymous),
    role,
    subscription: user.subscription || (role === 'admin' ? 'premium' : 'free'),
  };
}

function saveSession(user) {
  const normalizedUser = normalizeDemoUser(user);
  writeJson(DEMO_SESSION_KEY, normalizedUser);
  return normalizedUser;
}

export function buildDemoUserData(user) {
  const normalizedUser = normalizeDemoUser(user);

  return {
    email: normalizedUser.email,
    displayName: normalizedUser.displayName,
    photoURL: normalizedUser.photoURL,
    phoneNumber: normalizedUser.phoneNumber,
    role: normalizedUser.role,
    subscription: normalizedUser.subscription,
    isAnonymous: normalizedUser.isAnonymous,
    source: 'demo',
  };
}

export function getStoredDemoSession() {
  const session = readJson(DEMO_SESSION_KEY, null);
  return session ? normalizeDemoUser(session) : null;
}

export function clearStoredDemoSession() {
  removeItem(DEMO_SESSION_KEY);
  removeItem(DEMO_OTP_KEY);
}

export function signInDemoGuest() {
  return saveSession({
    uid: `demo-guest-${Date.now()}`,
    displayName: 'ضيف',
    isAnonymous: true,
  });
}

export function registerDemoWithEmail(email, password, displayName) {
  if (!email?.trim() || !password?.trim()) {
    throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (isAdminDemoEmail(normalizedEmail)) {
    throw new Error('هذا البريد مخصص لدخول لوحة الإدارة فقط.');
  }

  const accounts = readJson(DEMO_ACCOUNTS_KEY, []);
  const existingAccount = accounts.find((account) => account.email === normalizedEmail);

  if (existingAccount) {
    throw new Error('يوجد حساب محلي بهذا البريد بالفعل. جرّب تسجيل الدخول بدلاً من إنشاء حساب جديد.');
  }

  const newAccount = {
    uid: `demo-email-${Date.now()}`,
    email: normalizedEmail,
    password,
    displayName: displayName?.trim() || normalizedEmail.split('@')[0],
    isAnonymous: false,
    role: 'student',
    subscription: 'free',
  };

  writeJson(DEMO_ACCOUNTS_KEY, [...accounts, newAccount]);
  return saveSession(newAccount);
}

export function signInDemoWithEmail(email, password) {
  if (!email?.trim() || !password?.trim()) {
    throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (isAdminDemoEmail(normalizedEmail)) {
    if (password !== DEMO_ADMIN_PASSWORD) {
      throw new Error('بيانات دخول الأدمن غير صحيحة.');
    }

    return saveSession({
      uid: 'demo-admin-user',
      email: DEMO_ADMIN_EMAIL,
      displayName: 'Admin',
      isAnonymous: false,
      role: 'admin',
      subscription: 'premium',
    });
  }

  const accounts = readJson(DEMO_ACCOUNTS_KEY, []);
  const existingAccount = accounts.find((account) => account.email === normalizedEmail);

  if (existingAccount) {
    if (existingAccount.password !== password) {
      throw new Error('كلمة المرور غير صحيحة للحساب المحلي التجريبي.');
    }

    return saveSession(existingAccount);
  }

  const quickStartAccount = {
    uid: `demo-email-${Date.now()}`,
    email: normalizedEmail,
    password,
    displayName: normalizedEmail.split('@')[0],
    isAnonymous: false,
    role: 'student',
    subscription: 'free',
  };

  writeJson(DEMO_ACCOUNTS_KEY, [...accounts, quickStartAccount]);
  return saveSession(quickStartAccount);
}

export function signInDemoWithGoogle() {
  return saveSession({
    uid: 'demo-google-user',
    email: 'google.demo@example.com',
    displayName: 'Google Demo',
    isAnonymous: false,
    role: 'student',
    subscription: 'free',
  });
}

export function sendDemoOTP(phoneNumber) {
  if (!phoneNumber?.trim()) {
    throw new Error('يرجى إدخال رقم جوال صحيح.');
  }

  const payload = {
    phoneNumber: phoneNumber.trim(),
    code: '123456',
    demo: true,
  };

  writeJson(DEMO_OTP_KEY, payload);
  return payload;
}

export function verifyDemoOTP(confirmationResult, otpCode) {
  const pendingOtp = readJson(DEMO_OTP_KEY, confirmationResult || null);
  const expectedCode = pendingOtp?.code || '123456';

  if (String(otpCode).trim() !== expectedCode) {
    throw new Error('رمز التحقق التجريبي هو 123456');
  }

  const phoneNumber = pendingOtp?.phoneNumber || confirmationResult?.phoneNumber || null;
  const lastDigits = phoneNumber?.replace(/\D/g, '').slice(-4) || '0000';

  removeItem(DEMO_OTP_KEY);

  return saveSession({
    uid: `demo-phone-${lastDigits}`,
    phoneNumber,
    displayName: `مستخدم ${lastDigits}`,
    isAnonymous: false,
    role: 'student',
    subscription: 'free',
  });
}
