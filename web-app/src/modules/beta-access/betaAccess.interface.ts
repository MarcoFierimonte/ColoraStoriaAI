import type {
  AccessSessionResponse,
  AccessSource,
  AdminInviteMutationResponse,
  AdminInvitesListResponse,
  BetaInviteQuota,
  BetaInviteSummary,
  CreateInviteRequest,
  RedeemInviteRequest,
  UpdateInviteRequest,
} from '../../../../shared/types/index.ts';

export type {
  AccessSessionResponse,
  AccessSource,
  AdminInviteMutationResponse,
  AdminInvitesListResponse,
  BetaInviteQuota,
  BetaInviteSummary,
  CreateInviteRequest,
  RedeemInviteRequest,
  UpdateInviteRequest,
};

export class BetaAccessApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'BetaAccessApiError';
    this.statusCode = statusCode;
  }
}

export interface BetaAccessClient {
  fetchAccessSession(idToken?: string | null): Promise<AccessSessionResponse>;
  redeemInvite(code: string): Promise<AccessSessionResponse>;
  logoutInvite(): Promise<void>;
  listAdminInvites(idToken: string | null): Promise<BetaInviteSummary[]>;
  createAdminInvite(
    input: CreateInviteRequest,
    idToken: string | null
  ): Promise<BetaInviteSummary>;
  updateAdminInvite(
    code: string,
    input: UpdateInviteRequest,
    idToken: string | null
  ): Promise<BetaInviteSummary>;
  deleteAdminInvite(code: string, idToken: string | null): Promise<void>;
}
