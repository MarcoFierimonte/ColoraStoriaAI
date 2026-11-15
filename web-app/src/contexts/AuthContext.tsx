import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import {
  fetchAdminSession,
  type ProviderStatus,
} from '../services/coloringApi';
import { ensureAdminDoc } from '../services/firestoreLogs';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  idToken: string | null;
  promptVersions: string[];
  activePromptVersion: string | null;
  providers: ProviderStatus[];
  isSigningIn: boolean;
  authNotice: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [promptVersions, setPromptVersions] = useState<string[]>([]);
  const [activePromptVersion, setActivePromptVersion] = useState<string | null>(
    null
  );
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const syncAdminSession = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setIsAdmin(false);
      setIdToken(null);
      setPromptVersions([]);
      setActivePromptVersion(null);
      setProviders([]);
      return;
    }

    try {
      const token = await firebaseUser.getIdToken();
      const session = await fetchAdminSession(token);
      setIdToken(token);
      setIsAdmin(session.isAdmin);
      setPromptVersions(session.promptVersions);
      setActivePromptVersion(session.activePromptVersion);
      setProviders(session.providers);

      if (session.isAdmin && firebaseUser.email) {
        setAuthNotice(null);
        void ensureAdminDoc(firebaseUser.uid, firebaseUser.email).catch(
          (err) => {
            console.warn('Admin doc sync skipped:', err);
          }
        );
      } else {
        setAuthNotice(
          `Accesso effettuato con ${firebaseUser.email ?? 'questo account'}, ma la modalità Admin è riservata al profilo autorizzato.`
        );
      }
    } catch {
      setIsAdmin(false);
      setIdToken(null);
      setPromptVersions([]);
      setActivePromptVersion(null);
      setProviders([]);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      void syncAdminSession(firebaseUser).finally(() => {
        setAuthReady(true);
      });
    });

    return () => unsubscribe();
  }, [syncAdminSession]);

  const signInWithGoogle = useCallback(async () => {
    setIsSigningIn(true);
    setAuthNotice(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await syncAdminSession(cred.user);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (
        code !== 'auth/popup-closed-by-user' &&
        code !== 'auth/cancelled-popup-request'
      ) {
        setAuthNotice(
          'Impossibile completare l’accesso con Google. Verifica che i popup non siano bloccati e riprova.'
        );
      }
    } finally {
      setIsSigningIn(false);
    }
  }, [syncAdminSession]);

  const signOutUser = useCallback(async () => {
    setAuthNotice(null);
    await signOut(auth);
  }, []);

  const clearAuthNotice = useCallback(() => {
    setAuthNotice(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isAdmin,
        idToken,
        promptVersions,
        activePromptVersion,
        providers,
        isSigningIn,
        authNotice,
        signInWithGoogle,
        signOutUser,
        clearAuthNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
