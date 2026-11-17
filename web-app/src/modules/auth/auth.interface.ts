import type { ProviderStatus } from '../coloring-api/coloringApi.interface';

export interface AuthUserSummary {
  uid: string;
  email: string | null;
}

export interface AuthProviderGateway {
  subscribeAuthChanges(
    callback: (user: AuthUserSummary | null) => void
  ): () => void;
  signInWithGoogle(): Promise<AuthUserSummary>;
  signOut(): Promise<void>;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
}

export interface AuthContextValue {
  user: AuthUserSummary | null;
  authReady: boolean;
  isAdmin: boolean;
  hasAdminClaim: boolean;
  idToken: string | null;
  promptVersions: string[];
  activePromptVersion: string | null;
  providers: ProviderStatus[];
  isSigningIn: boolean;
  authNotice: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthNotice: () => void;
  refreshIdToken: () => Promise<string | null>;
}
