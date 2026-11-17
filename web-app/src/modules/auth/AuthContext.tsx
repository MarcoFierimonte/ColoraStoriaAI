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
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [promptVersions, setPromptVersions] = useState<string[]>([]);
  const [activePromptVersion, setActivePromptVersion] = useState<string | null>(
    null
  );
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const syncAdminSession = useCallback(
    async (authUser: AuthUserSummary | null, forceTokenRefresh = false) => {
      if (!authUser) {
        setIsAdmin(false);
        setHasAdminClaim(false);
        setIdToken(null);
        setPromptVersions([]);
        setActivePromptVersion(null);
        setProviders([]);
        return;
      }

      try {
        let token = await gateway.getIdToken(forceTokenRefresh);
        let session = await apiClient.fetchAdminSession(token);

        // If the user is identified as admin via email allowlist, but the token doesn't have custom claims yet,
        // force a token refresh from Firebase Auth in case custom claims were recently updated on the server.
        if (session.isAdmin && !session.hasAdminClaim && !forceTokenRefresh) {
          const freshToken = await gateway.getIdToken(true);
          if (freshToken && freshToken !== token) {
            token = freshToken;
            session = await apiClient.fetchAdminSession(token);
          }
        }

        const claimActive = Boolean(session.hasAdminClaim);
        setIdToken(token);
        setIsAdmin(session.isAdmin);
        setHasAdminClaim(claimActive);
        setPromptVersions(session.promptVersions);
        setActivePromptVersion(session.activePromptVersion);
        setProviders(session.providers);

        if (session.isAdmin && authUser.email) {
          setAuthNotice(
            claimActive
              ? `Accesso Admin completato con successo (${authUser.email}). Controlli, telemetria e storico Firestore abilitati.`
              : `Accesso Admin completato con successo (${authUser.email}). Controlli e telemetria live abilitati.`
          );
          if (claimActive) {
            void logRepository
              .ensureAdminProfile({ uid: authUser.uid, email: authUser.email })
              .catch((err) => {
                console.warn('Admin doc sync skipped:', err);
              });
          }
        } else {
          setAuthNotice(
            `Accesso effettuato con ${authUser.email ?? 'questo account'}, ma la modalità Admin è riservata agli indirizzi autorizzati in ADMIN_EMAILS.`
          );
        }
      } catch (err) {
        console.error('[AUTH] syncAdminSession error:', err);
        setIsAdmin(false);
        setHasAdminClaim(false);
        setIdToken(null);
        setPromptVersions([]);
        setActivePromptVersion(null);
        setProviders([]);
        setAuthNotice(
          `Accesso effettuato con ${authUser.email ?? 'questo account'}, ma la verifica con il server non è riuscita. Ricarica la pagina e riprova.`
        );
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
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return;
      }

      console.error('[AUTH] Google sign-in error:', code || 'unknown', err);

      if (code === 'auth/popup-blocked') {
        setAuthNotice(
          'Il browser ha bloccato il popup di accesso. Abilita i popup per questo sito e riprova.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        const currentHost =
          typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthNotice(
          `Dominio "${currentHost}" non autorizzato in Firebase Authentication (auth/unauthorized-domain). Aggiungilo in Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (code === 'auth/operation-not-allowed') {
        setAuthNotice(
          'Accesso con Google non abilitato in Firebase Authentication (auth/operation-not-allowed).'
        );
      } else if (code === 'auth/network-request-failed') {
        setAuthNotice(
          'Errore di rete o blocco sicurezza (CSP/estensioni) durante l’accesso con Google (auth/network-request-failed).'
        );
      } else {
        setAuthNotice(
          `Impossibile completare l’accesso con Google${code ? ` (${code})` : ''}. Controlla i domini autorizzati in Firebase Console o i dettagli nella console del browser.`
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

  const refreshIdToken = useCallback(
    (forceRefresh = true) => {
      return gateway.getIdToken(forceRefresh);
    },
    [gateway]
  );

  const refreshAdminSession = useCallback(async () => {
    if (user) {
      await syncAdminSession(user, true);
    }
  }, [user, syncAdminSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isAdmin,
        hasAdminClaim,
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
        refreshAdminSession,
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
