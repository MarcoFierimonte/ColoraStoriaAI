import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../../database/implementations/firebaseAppInstance';
import type { AuthProviderGateway, AuthUserSummary } from '../auth.interface';

function mapUser(user: User | null): AuthUserSummary | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
  };
}

export class FirebaseAuthGateway implements AuthProviderGateway {
  subscribeAuthChanges(
    callback: (user: AuthUserSummary | null) => void
  ): () => void {
    return onAuthStateChanged(auth, (firebaseUser) => {
      callback(mapUser(firebaseUser));
    });
  }

  async signInWithGoogle(): Promise<AuthUserSummary> {
    const cred = await signInWithPopup(auth, googleProvider);
    return {
      uid: cred.user.uid,
      email: cred.user.email,
    };
  }

  async signOut(): Promise<void> {
    await signOut(auth);
  }

  async getIdToken(forceRefresh = false): Promise<string | null> {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken(forceRefresh);
  }
}
