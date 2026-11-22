import type {
  AccessSessionResponse,
  BetaAccessClient,
  BetaInviteSummary,
  CreateInviteRequest,
  UpdateInviteRequest,
} from './betaAccess.interface';
import { FetchBetaAccessClient } from './implementations/fetchBetaAccessClient';

export {
  BetaAccessApiError,
  type AccessSessionResponse,
  type AccessSource,
  type AdminInviteMutationResponse,
  type AdminInvitesListResponse,
  type BetaAccessClient,
  type BetaInviteQuota,
  type BetaInviteSummary,
  type CreateInviteRequest,
  type RedeemInviteRequest,
  type UpdateInviteRequest,
} from './betaAccess.interface';
export { FetchBetaAccessClient } from './implementations/fetchBetaAccessClient';

export const betaAccessClient: BetaAccessClient = new FetchBetaAccessClient('/api');

export function fetchAccessSessionApi(
  idToken?: string | null
): Promise<AccessSessionResponse> {
  return betaAccessClient.fetchAccessSession(idToken);
}

export function redeemInviteApi(code: string): Promise<AccessSessionResponse> {
  return betaAccessClient.redeemInvite(code);
}

export function logoutInviteApi(): Promise<void> {
  return betaAccessClient.logoutInvite();
}

export function listAdminInvitesApi(
  idToken: string | null
): Promise<BetaInviteSummary[]> {
  return betaAccessClient.listAdminInvites(idToken);
}

export function createAdminInviteApi(
  input: CreateInviteRequest,
  idToken: string | null
): Promise<BetaInviteSummary> {
  return betaAccessClient.createAdminInvite(input, idToken);
}

export function updateAdminInviteApi(
  code: string,
  input: UpdateInviteRequest,
  idToken: string | null
): Promise<BetaInviteSummary> {
  return betaAccessClient.updateAdminInvite(code, input, idToken);
}

export function deleteAdminInviteApi(
  code: string,
  idToken: string | null
): Promise<void> {
  return betaAccessClient.deleteAdminInvite(code, idToken);
}
