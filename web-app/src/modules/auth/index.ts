import { createElement } from 'react';
import type {
  AuthContextValue,
  AuthProviderGateway,
  AuthUserSummary,
} from './auth.interface';
import {
  AuthProvider as BaseAuthProvider,
  useAuth,
  type AuthProviderProps,
} from './AuthContext';
import { FirebaseAuthGateway } from './implementations/firebaseAuthGateway';

export type { AuthContextValue, AuthProviderGateway, AuthUserSummary };
export { useAuth, type AuthProviderProps };
export { FirebaseAuthGateway } from './implementations/firebaseAuthGateway';

export const defaultAuthGateway: AuthProviderGateway =
  new FirebaseAuthGateway();

export type WiredAuthProviderProps = Omit<AuthProviderProps, 'gateway'> & {
  gateway?: AuthProviderGateway;
};

export function AuthProvider({
  gateway = defaultAuthGateway,
  children,
  ...rest
}: WiredAuthProviderProps) {
  return createElement(BaseAuthProvider, { gateway, children, ...rest });
}
