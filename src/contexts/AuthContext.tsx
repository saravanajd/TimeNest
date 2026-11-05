import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { firebaseConfigured, getFirebaseServices } from '../services/firebase';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  authError: string;
  signIn: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void Promise.all([getFirebaseServices(), import('firebase/auth')])
      .then(([{ auth }, authSdk]) => {
        if (!active) return;
        unsubscribe = authSdk.onAuthStateChanged(
          auth,
          (nextUser) => {
            setUser(nextUser);
            setAuthError('');
            setLoading(false);
          },
          (error) => {
            setUser(null);
            setAuthError(error.message);
            setLoading(false);
          },
        );
      })
      .catch((error: unknown) => {
        if (active) {
          setAuthError(error instanceof Error ? error.message : 'Firebase could not be initialized.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: firebaseConfigured,
      loading,
      user,
      authError,
      signIn: async (email, password) => {
        const [{ auth }, authSdk] = await Promise.all([getFirebaseServices(), import('firebase/auth')]);
        await authSdk.signInWithEmailAndPassword(auth, email, password);
      },
      createAccount: async (email, password) => {
        const [{ auth }, authSdk] = await Promise.all([getFirebaseServices(), import('firebase/auth')]);
        await authSdk.createUserWithEmailAndPassword(auth, email, password);
      },
      resetPassword: async (email) => {
        const [{ auth }, authSdk] = await Promise.all([getFirebaseServices(), import('firebase/auth')]);
        await authSdk.sendPasswordResetEmail(auth, email);
      },
      signOutUser: async () => {
        const [{ auth }, authSdk] = await Promise.all([getFirebaseServices(), import('firebase/auth')]);
        await authSdk.signOut(auth);
      },
    }),
    [authError, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}

export default AuthProvider;
