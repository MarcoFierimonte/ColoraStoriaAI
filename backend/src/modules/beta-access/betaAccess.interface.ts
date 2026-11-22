import type {
  AccessSessionResponse,
  BetaInviteQuota,
  BetaInviteSummary,
  CreateInviteRequest,
  UpdateInviteRequest,
} from '../../../../shared/types/index.ts';

export type BetaAccessReason =
  | 'missing'
  | 'invalid'
  | 'revoked'
  | 'expired'
  | 'exhausted'
  | 'conflict'
  | 'validation';

export class BetaAccessError extends Error {
  readonly statusCode: number;
  readonly reason: BetaAccessReason;

  constructor(
    message: string,
    statusCode = 403,
    reason: BetaAccessReason = 'invalid'
  ) {
    super(message);
    this.name = 'BetaAccessError';
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

export interface BetaInviteRecord {
  code: string;
  label: string;
  maxGenerations: number;
  usedGenerations: number;
  expiresAtMs: number | null;
  active: boolean;
  createdAtMs: number;
  createdByEmail: string;
  lastUsedAtMs: number | null;
}

export interface HttpCookieRequest {
  headers: {
    cookie?: string | string[] | undefined;
  };
}

export interface InviteReservation {
  code: string;
  inviteQuota: BetaInviteQuota;
}

export interface BetaInvitePatch {
  active?: boolean;
  maxGenerations?: number;
  expiresAtMs?: number | null;
}

export interface BetaInviteStore {
  getByCode(code: string): Promise<BetaInviteRecord | null>;
  listAll(): Promise<BetaInviteRecord[]>;
  create(record: BetaInviteRecord): Promise<BetaInviteRecord>;
  update(
    code: string,
    patch: BetaInvitePatch
  ): Promise<BetaInviteRecord | null>;
  delete(code: string): Promise<boolean>;
  consumeGeneration(code: string, nowMs: number): Promise<BetaInviteRecord>;
  refundGeneration(code: string): Promise<void>;
}

export interface BetaAccessService {
  isInviteRequired(): boolean;
  getSession(
    req: HttpCookieRequest,
    isAdmin: boolean
  ): Promise<AccessSessionResponse>;
  redeemCode(
    rawCode: string
  ): Promise<{ session: AccessSessionResponse; setCookieHeader: string }>;
  buildClearCookieHeader(): string;
  assertCanGenerate(req: HttpCookieRequest, isAdmin: boolean): Promise<void>;
  assertCanExportPdf(req: HttpCookieRequest, isAdmin: boolean): Promise<void>;
  reserveGeneration(
    req: HttpCookieRequest,
    isAdmin: boolean
  ): Promise<InviteReservation | null>;
  refundGeneration(reservation: InviteReservation | null): Promise<void>;
  listInvites(): Promise<BetaInviteSummary[]>;
  createInvite(
    input: CreateInviteRequest,
    createdByEmail: string
  ): Promise<BetaInviteSummary>;
  updateInvite(
    code: string,
    input: UpdateInviteRequest
  ): Promise<BetaInviteSummary>;
  deleteInvite(code: string): Promise<void>;
}
