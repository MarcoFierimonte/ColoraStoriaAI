import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  coloringApiClient,
  type ColoringApiClient,
  type ProviderStatus,
} from '../coloring-api';
import {
  generationLogRepository,
  type GenerationLogRepository,
} from '../database';
import type {
  AuthContextValue,
  AuthProviderGateway,
  AuthUserSummary,
} from './auth.interface';

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  gateway: AuthProviderGateway;
  apiClient?: ColoringApiClient;
  logRepository?: GenerationLogRepository;
}

export function AuthProvider({
  children,
  gateway,
  apiClient = coloringApiClient,
  logRepository = generationLogRepository,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUserSummary | null>(null);
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

  const syncAdminSession = useCallback(
    async (authUser: AuthUserSummary | null) => {
      if (!authUser) {
        setIsAdmin(false);
        setIdToken(null);
        setPromptVersions([]);
        setActivePromptVersion(null);
        setProviders([]);
        return;
      }

      try {
        const token = await gateway.getIdToken();
        const session = await apiClient.fetchAdminSession(token);
        setIdToken(token);
        setIsAdmin(session.isAdmin);
        setPromptVersions(session.promptVersions);
        setActivePromptVersion(session.activePromptVersion);
        setProviders(session.providers);

        if (session.isAdmin && authUser.email) {
          setAuthNotice(null);
          void logRepository
            .ensureAdminProfile({ uid: authUser.uid, email: authUser.email })
            .catch((err) => {
              console.warn('Admin doc sync skipped:', err);
            });
        } else {
          setAuthNotice(
            `Accesso effettuato con ${authUser.email ?? 'questo account'}, ma la modalità Admin è riservata al profilo autorizzato.`
          );
        }
      } catch {
        setIsAdmin(false);
        setIdToken(null);
        setPromptVersions([]);
        setActivePromptVersion(null);
        setProviders([]);
      }
    },
    [gateway, apiClient, logRepository]
  );

  useEffect(() => {
    const unsubscribe = gateway.subscribeAuthChanges((authUser) => {
      setUser(authUser);
      void syncAdminSession(authUser).finally(() => {
        setAuthReady(true);
      });
    });

    return () => unsubscribe();
  }, [gateway, syncAdminSession]);

  const signInWithGoogle = useCallback(async () => {
    setIsSigningIn(true);
    setAuthNotice(null);
    try {
      const signedInUser = await gateway.signInWithGoogle();
      await syncAdminSession(signedInUser);
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
  }, [gateway, syncAdminSession]);

  const signOutUser = useCallback(async () => {
    setAuthNotice(null);
    await gateway.signOut();
  }, [gateway]);

  const clearAuthNotice = useCallback(() => {
    setAuthNotice(null);
  }, []);

  const refreshIdToken = useCallback(() => {
    return gateway.getIdToken();
  }, [gateway]);

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
        refreshIdToken,
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
