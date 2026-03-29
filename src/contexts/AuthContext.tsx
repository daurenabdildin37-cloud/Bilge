import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { auth, googleProvider, db } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  signInWithRedirect, 
  getRedirectResult,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  isApiOk: boolean;
  setIsApiOk: (ok: boolean) => void;
  isClaudeApiOk: boolean;
  setIsClaudeApiOk: (ok: boolean) => void;
  isAdmin: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApiOk, setIsApiOk] = useState(!!localStorage.getItem('GEMINI_API_KEY'));
  const [isClaudeApiOk, setIsClaudeApiOk] = useState(!!localStorage.getItem('CLAUDE_API_KEY'));

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const email = user.email?.toLowerCase().trim();
    const adminUid = import.meta.env.VITE_ADMIN_UID;
    
    return (
      email === 'nurghaliieva1977@mail.ru' || 
      email === 'abdildindauren4@gmail.com' || 
      email === 'daurenabdildin464@gmail.com' || 
      email === 'abdildindauren95@gmail.com' || 
      email === 'daurenabdildin37@gmail.com' || 
      user.uid === adminUid || 
      (adminUid && email === adminUid.toLowerCase().trim()) || 
      user.role === 'admin'
    );
  }, [user?.uid, user?.email, user?.role]);

  useEffect(() => {
    console.log("AuthContext: Setting up onAuthStateChanged listener");
    let unsubscribeFirestore: (() => void) | null = null;
    let isInitialCheck = true;
    const isRedirecting = localStorage.getItem('isRedirecting') === 'true';

    // Handle redirect result first to ensure we catch any redirect-based login
    const handleRedirect = async () => {
      try {
        if (isRedirecting) {
          console.log("AuthContext: Checking for redirect result (isRedirecting=true)...");
          const result = await getRedirectResult(auth);
          if (result?.user) {
            console.log("AuthContext: Found user from redirect:", result.user.uid);
          } else {
            console.log("AuthContext: No redirect result user found after redirect");
          }
          localStorage.removeItem('isRedirecting');
        } else {
          console.log("AuthContext: Checking for redirect result (isRedirecting=false)...");
          await getRedirectResult(auth);
        }
      } catch (error: any) {
        console.error("AuthContext: Redirect result error:", error);
        localStorage.removeItem('isRedirecting');
      }
    };

    handleRedirect();

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthContext: onAuthStateChanged fired", firebaseUser ? `UID: ${firebaseUser.uid}` : "NULL");
      
      // Clean up previous Firestore listener if it exists
      if (unsubscribeFirestore) {
        console.log("AuthContext: Cleaning up previous Firestore listener");
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (!firebaseUser) {
        console.log("AuthContext: No Firebase user, clearing state");
        setUser(null);
        
        // If we are still in redirect flow, don't set loading to false yet
        if (isRedirecting && isInitialCheck) {
          console.log("AuthContext: Still in redirect flow, waiting...");
          return;
        }

        // Only clear localStorage if we're sure it's not a temporary null during redirect
        if (!isInitialCheck) {
          localStorage.removeItem('GEMINI_API_KEY');
          localStorage.removeItem('CLAUDE_API_KEY');
          setIsApiOk(false);
          setIsClaudeApiOk(false);
        }
        setLoading(false);
        isInitialCheck = false;
        return;
      }

      isInitialCheck = false;
      // 1. Set initial user immediately to unblock UI
      const initialUser: User = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        role: 'teacher'
      };
      
      setUser(prev => {
        if (prev?.uid === initialUser.uid) return prev;
        return initialUser;
      });
      
      setLoading(false);

      // 2. Sync with Firestore in real-time
      console.log("AuthContext: Setting up Firestore listener for", firebaseUser.uid);
      const userRef = doc(db, 'users', firebaseUser.uid);
      
      unsubscribeFirestore = onSnapshot(userRef, async (userDoc) => {
        console.log("AuthContext: Firestore user document changed for", firebaseUser.uid);
        
        if (!userDoc.exists()) {
          console.log("AuthContext: No Firestore document for user, creating one...");
          try {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              photoURL: firebaseUser.photoURL || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              role: 'teacher'
            }, { merge: true });
          } catch (err) {
            console.error("AuthContext: Error creating user doc:", err);
          }
          return;
        }

        const existingData = userDoc.data() as any;
        console.log("AuthContext: User data from Firestore:", { role: existingData.role });
        
        const newUser: User = { 
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: existingData.displayName || firebaseUser.displayName || initialUser.displayName,
          photoURL: existingData.photoURL || firebaseUser.photoURL || initialUser.photoURL,
          role: existingData.role || 'teacher',
          gemini_api_key: existingData.gemini_api_key,
          claude_api_key: existingData.claude_api_key,
          school: existingData.school
        };
        
        setUser(prev => {
          if (prev) {
            const isSame = 
              prev.uid === newUser.uid && 
              prev.displayName === newUser.displayName && 
              prev.role === newUser.role && 
              prev.gemini_api_key === newUser.gemini_api_key &&
              prev.claude_api_key === newUser.claude_api_key &&
              prev.school === newUser.school &&
              prev.email === newUser.email &&
              prev.photoURL === newUser.photoURL;

            if (isSame) return prev;
          }
          return newUser;
        });

        if (existingData.gemini_api_key) {
          localStorage.setItem('GEMINI_API_KEY', existingData.gemini_api_key);
          setIsApiOk(true);
        }

        if (existingData.claude_api_key) {
          localStorage.setItem('CLAUDE_API_KEY', existingData.claude_api_key);
          setIsClaudeApiOk(true);
        }
      }, (error) => {
        console.error("AuthContext: Firestore listener error:", error);
      });
    });

    return () => {
      console.log("AuthContext: Cleaning up listeners");
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const login = useCallback(async () => {
    if (!auth || !googleProvider) return;
    try {
      console.log("AuthContext: Attempting signInWithPopup...");
      await signInWithPopup(auth, googleProvider);
      console.log("AuthContext: signInWithPopup successful");
    } catch (err: any) {
      console.error("Login popup error:", err);
      const redirectErrors = [
        'auth/popup-blocked',
        'auth/cancelled-popup-request',
        'auth/popup-closed-by-user',
        'auth/internal-error'
      ];
      
      if (redirectErrors.includes(err.code) || err.message?.includes('popup')) {
        try {
          console.log("AuthContext: Falling back to signInWithRedirect...");
          localStorage.setItem('isRedirecting', 'true');
          await signInWithRedirect(auth, googleProvider);
        } catch (redirErr) {
          console.error("Redirect login error:", redirErr);
          localStorage.removeItem('isRedirecting');
          throw redirErr;
        }
      } else {
        throw err;
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, []);

  const value = useMemo(() => ({ 
    user, setUser, loading, isApiOk, setIsApiOk, isClaudeApiOk, setIsClaudeApiOk, isAdmin, login, logout 
  }), [user, loading, isApiOk, isClaudeApiOk, isAdmin, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
