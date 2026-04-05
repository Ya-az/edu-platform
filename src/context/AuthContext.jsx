import { useState, useEffect } from 'react';
import { AuthContext } from './auth-context';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInWithPhoneNumber,
  signInAnonymously,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db, setupRecaptcha, isFirebaseConfigured } from '../services/firebase';
import {
  buildDemoUserData,
  clearStoredDemoSession,
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD,
  getStoredDemoSession,
  registerDemoWithEmail,
  sendDemoOTP,
  signInDemoGuest,
  signInDemoWithEmail,
  signInDemoWithGoogle,
  verifyDemoOTP,
} from '../services/demoAuthService';

const DEMO_MODE = !isFirebaseConfigured();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyDemoSession = (demoUser) => {
    setUser(demoUser);
    setUserData(demoUser ? buildDemoUserData(demoUser) : null);
    return demoUser;
  };

  // Create or fetch user document in Firestore
  const ensureUserDoc = async (firebaseUser) => {
    if (DEMO_MODE) {
      setUserData(buildDemoUserData(firebaseUser));
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      } else {
        const newUserData = {
          email: firebaseUser.email || null,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'ضيف',
          photoURL: firebaseUser.photoURL || null,
          phoneNumber: firebaseUser.phoneNumber || null,
          role: 'student',
          subscription: 'free',
          isAnonymous: firebaseUser.isAnonymous || false,
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newUserData);
        setUserData(newUserData);
      }
    } catch (error) {
      console.error('User profile sync error:', error);
      setUserData(buildDemoUserData(firebaseUser));
    }
  };

  useEffect(() => {
    if (DEMO_MODE) {
      const storedDemoUser = getStoredDemoSession();

      if (storedDemoUser) {
        applyDemoSession(storedDemoUser);
      } else {
        setUser(null);
        setUserData(null);
      }

      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          await ensureUserDoc(firebaseUser);
        } else {
          setUser(null);
          setUserData(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 1. Google login
  const loginWithGoogle = async () => {
    if (DEMO_MODE) {
      return applyDemoSession(signInDemoWithGoogle());
    }

    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  };

  // 2. Email/Password registration
  const registerWithEmail = async (email, password, displayName) => {
    if (DEMO_MODE) {
      return applyDemoSession(registerDemoWithEmail(email, password, displayName));
    }

    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    return result.user;
  };

  // 3. Email/Password login
  const loginWithEmail = async (email, password) => {
    if (DEMO_MODE) {
      return applyDemoSession(signInDemoWithEmail(email, password));
    }

    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  // 4. Phone OTP - send code
  const sendPhoneOTP = async (phoneNumber, recaptchaContainerId) => {
    if (DEMO_MODE) {
      return sendDemoOTP(phoneNumber);
    }

    const recaptchaVerifier = setupRecaptcha(recaptchaContainerId);
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return confirmationResult;
  };

  // 5. Phone OTP - verify code
  const verifyPhoneOTP = async (confirmationResult, otpCode) => {
    if (DEMO_MODE) {
      return applyDemoSession(verifyDemoOTP(confirmationResult, otpCode));
    }

    const result = await confirmationResult.confirm(otpCode);
    return result.user;
  };

  // 6. Guest (anonymous) login
  const loginAsGuest = async () => {
    if (DEMO_MODE) {
      return applyDemoSession(signInDemoGuest());
    }

    const result = await signInAnonymously(auth);
    return result.user;
  };

  // Logout
  const logout = async () => {
    if (DEMO_MODE) {
      clearStoredDemoSession();
      setUser(null);
      setUserData(null);
      return;
    }

    await signOut(auth);
  };

  const isAdmin = userData?.role === 'admin';
  const isPremium = userData?.subscription === 'premium';
  const isGuest = user?.isAnonymous || false;

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        loginWithGoogle,
        registerWithEmail,
        loginWithEmail,
        sendPhoneOTP,
        verifyPhoneOTP,
        loginAsGuest,
        logout,
        isAdmin,
        isPremium,
        isGuest,
        isDemoMode: DEMO_MODE,
        demoAdminEmail: DEMO_ADMIN_EMAIL,
        demoAdminPassword: DEMO_ADMIN_PASSWORD,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

