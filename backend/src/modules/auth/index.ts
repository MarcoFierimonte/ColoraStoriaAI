import { serverConfig } from '../config/index.ts';
import type {
  AdminAuthContext,
  AuthTokenVerifier,
  HttpAuthRequest,
} from './auth.interface.ts';
import { FirebaseAdminTokenVerifier } from './implementations/firebaseAdminTokenVerifier.ts';

export type {
  AdminAuthContext,
  AuthTokenVerifier,
  HttpAuthRequest,
} from './auth.interface.ts';
export { FirebaseAdminTokenVerifier } from './implementations/firebaseAdminTokenVerifier.ts';

export const authTokenVerifier: AuthTokenVerifier =
  new FirebaseAdminTokenVerifier(serverConfig);

export async function verifyOptionalAdmin(
  req: HttpAuthRequest
): Promise<AdminAuthContext> {
  return authTokenVerifier.verifyOptionalRequest(req);
}
