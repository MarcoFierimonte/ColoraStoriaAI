export interface BetaInviteQuota {
  label: string;
  maxGenerations: number;
  usedGenerations: number;
  remainingGenerations: number;
  expiresAtMs: number | null;
}

export interface BetaInviteSummary {
  code: string;
  label: string;
  maxGenerations: number;
  usedGenerations: number;
  remainingGenerations: number;
  expiresAtMs: number | null;
  active: boolean;
  isExpired: boolean;
  isExhausted: boolean;
  createdAtMs: number;
  lastUsedAtMs: number | null;
}

export type AccessSource = 'open' | 'admin' | 'invite' | 'none';

export interface AccessSessionResponse {
  inviteRequired: boolean;
  hasAccess: boolean;
  accessSource: AccessSource;
  invite: BetaInviteQuota | null;
}

export interface RedeemInviteRequest {
  code: string;
}

export interface CreateInviteRequest {
  label: string;
  code?: string;
  maxGenerations: number;
  expiresInDays?: number | null;
  expiresAtMs?: number | null;
}

export interface UpdateInviteRequest {
  active?: boolean;
  maxGenerations?: number;
  expiresAtMs?: number | null;
}

export interface AdminInvitesListResponse {
  invites: BetaInviteSummary[];
}

export interface AdminInviteMutationResponse {
  invite: BetaInviteSummary;
}
