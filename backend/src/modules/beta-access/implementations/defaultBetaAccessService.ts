import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  AccessSessionResponse,
  BetaInviteQuota,
  BetaInviteSummary,
  CreateInviteRequest,
  UpdateInviteRequest,
} from '../../../../../shared/types/index.ts';
import { getServerConfig, type ServerConfig } from '../../config/index.ts';
import {
  BetaAccessError,
  type BetaAccessService,
  type BetaInviteRecord,
  type BetaInviteStore,
  type HttpCookieRequest,
  type InviteReservation,
} from '../betaAccess.interface.ts';

const INVITE_COOKIE_NAME = 'cs_invite';
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,31}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_COOKIE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface SignedCookiePayload {
  c: string;
  exp: number;
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase();
}

function generateInviteCode(): string {
  const bytes = randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `BETA-${suffix}`;
}

function parseCookies(headerValue: string | string[] | undefined): Map<string, string> {
  const result = new Map<string, string>();
  const raw = Array.isArray(headerValue) ? headerValue.join('; ') : headerValue;
  if (!raw) return result;

  for (const part of raw.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (key) {
      result.set(key, val);
    }
  }
  return result;
}

function toQuota(record: BetaInviteRecord): BetaInviteQuota {
  return {
    label: record.label,
    maxGenerations: record.maxGenerations,
    usedGenerations: record.usedGenerations,
    remainingGenerations: Math.max(
      0,
      record.maxGenerations - record.usedGenerations
    ),
    expiresAtMs: record.expiresAtMs,
  };
}

function toSummary(record: BetaInviteRecord, nowMs: number): BetaInviteSummary {
  const remaining = Math.max(0, record.maxGenerations - record.usedGenerations);
  return {
    code: record.code,
    label: record.label,
    maxGenerations: record.maxGenerations,
    usedGenerations: record.usedGenerations,
    remainingGenerations: remaining,
    expiresAtMs: record.expiresAtMs,
    active: record.active,
    isExpired: record.expiresAtMs !== null && record.expiresAtMs <= nowMs,
    isExhausted: remaining === 0,
    createdAtMs: record.createdAtMs,
    lastUsedAtMs: record.lastUsedAtMs,
  };
}

export class DefaultBetaAccessService implements BetaAccessService {
  private readonly store: BetaInviteStore;
  private readonly config: ServerConfig;
  private readonly now: () => number;

  constructor(
    store: BetaInviteStore,
    config: ServerConfig = getServerConfig(),
    now: () => number = () => Date.now()
  ) {
    this.store = store;
    this.config = config;
    this.now = now;
  }

  isInviteRequired(): boolean {
    return this.config.betaInviteRequired;
  }

  private signToken(payload: SignedCookiePayload): string {
    const secret = this.config.betaSessionSecret;
    if (!secret) {
      throw new Error('BETA_SESSION_SECRET is missing when signing invite cookie.');
    }
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyCookieFromRequest(req: HttpCookieRequest): string | null {
    const secret = this.config.betaSessionSecret;
    if (!secret) return null;

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.get(INVITE_COOKIE_NAME);
    if (!token) return null;

    const dotIdx = token.indexOf('.');
    if (dotIdx <= 0) return null;

    const body = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expectedSig = createHmac('sha256', secret)
      .update(body)
      .digest('base64url');

    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8')
      ) as Partial<SignedCookiePayload>;
      const code = normalizeCode(parsed.c);
      if (!CODE_PATTERN.test(code)) return null;
      if (typeof parsed.exp !== 'number' || parsed.exp <= this.now()) {
        return null;
      }
      return code;
    } catch {
      return null;
    }
  }

  private buildSetCookieHeader(record: BetaInviteRecord): string {
    const nowMs = this.now();
    const cookieExpMs =
      record.expiresAtMs !== null
        ? Math.min(record.expiresAtMs, nowMs + MAX_COOKIE_LIFETIME_MS)
        : nowMs + MAX_COOKIE_LIFETIME_MS;
    const maxAgeSec = Math.max(1, Math.floor((cookieExpMs - nowMs) / 1000));
    const token = this.signToken({ c: record.code, exp: cookieExpMs });

    const parts = [
      `${INVITE_COOKIE_NAME}=${token}`,
      'Path=/',
      `Max-Age=${maxAgeSec}`,
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (!this.config.isDevelopment) {
      parts.push('Secure');
    }
    return parts.join('; ');
  }

  buildClearCookieHeader(): string {
    const parts = [
      `${INVITE_COOKIE_NAME}=`,
      'Path=/',
      'Max-Age=0',
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (!this.config.isDevelopment) {
      parts.push('Secure');
    }
    return parts.join('; ');
  }

  private assertUsableRecord(
    record: BetaInviteRecord | null,
    nowMs: number,
    options: { requireRemainingQuota: boolean }
  ): BetaInviteRecord {
    if (!record) {
      throw new BetaAccessError('Codice invito non valido.', 403, 'invalid');
    }
    if (!record.active) {
      throw new BetaAccessError(
        'Questo invito è stato disattivato.',
        403,
        'revoked'
      );
    }
    if (record.expiresAtMs !== null && record.expiresAtMs <= nowMs) {
      throw new BetaAccessError('Questo invito è scaduto.', 403, 'expired');
    }
    if (
      options.requireRemainingQuota &&
      record.usedGenerations >= record.maxGenerations
    ) {
      throw new BetaAccessError(
        'Hai già utilizzato tutte le generazioni incluse in questo invito.',
        403,
        'exhausted'
      );
    }
    return record;
  }

  async getSession(
    req: HttpCookieRequest,
    isAdmin: boolean
  ): Promise<AccessSessionResponse> {
    if (isAdmin) {
      return {
        inviteRequired: this.config.betaInviteRequired,
        hasAccess: true,
        accessSource: 'admin',
        invite: null,
      };
    }

    if (!this.config.betaInviteRequired) {
      return {
        inviteRequired: false,
        hasAccess: true,
        accessSource: 'open',
        invite: null,
      };
    }

    const code = this.verifyCookieFromRequest(req);
    if (!code) {
      return {
        inviteRequired: true,
        hasAccess: false,
        accessSource: 'none',
        invite: null,
      };
    }

    const record = await this.store.getByCode(code);
    const nowMs = this.now();
    if (
      !record ||
      !record.active ||
      (record.expiresAtMs !== null && record.expiresAtMs <= nowMs)
    ) {
      return {
        inviteRequired: true,
        hasAccess: false,
        accessSource: 'none',
        invite: null,
      };
    }

    const quota = toQuota(record);
    return {
      inviteRequired: true,
      hasAccess: quota.remainingGenerations > 0,
      accessSource: quota.remainingGenerations > 0 ? 'invite' : 'none',
      invite: quota,
    };
  }

  async redeemCode(
    rawCode: string
  ): Promise<{ session: AccessSessionResponse; setCookieHeader: string }> {
    const code = normalizeCode(rawCode);
    if (!CODE_PATTERN.test(code)) {
      throw new BetaAccessError(
        'Inserisci un codice invito valido (es. MARCO-BETA).',
        400,
        'validation'
      );
    }

    const record = await this.store.getByCode(code);
    const usable = this.assertUsableRecord(record, this.now(), {
      requireRemainingQuota: true,
    });

    return {
      session: {
        inviteRequired: this.config.betaInviteRequired,
        hasAccess: true,
        accessSource: this.config.betaInviteRequired ? 'invite' : 'open',
        invite: toQuota(usable),
      },
      setCookieHeader: this.config.betaSessionSecret
        ? this.buildSetCookieHeader(usable)
        : '',
    };
  }

  async assertCanGenerate(
    req: HttpCookieRequest,
    isAdmin: boolean
  ): Promise<void> {
    if (isAdmin || !this.config.betaInviteRequired) {
      return;
    }

    const code = this.verifyCookieFromRequest(req);
    if (!code) {
      throw new BetaAccessError(
        'Accesso riservato agli invitati. Inserisci il tuo codice invito per generare una pagina.',
        403,
        'missing'
      );
    }

    const record = await this.store.getByCode(code);
    this.assertUsableRecord(record, this.now(), {
      requireRemainingQuota: true,
    });
  }

  async assertCanExportPdf(
    req: HttpCookieRequest,
    isAdmin: boolean
  ): Promise<void> {
    if (isAdmin || !this.config.betaInviteRequired) {
      return;
    }

    const code = this.verifyCookieFromRequest(req);
    if (!code) {
      throw new BetaAccessError(
        'Accesso riservato agli invitati. Inserisci un codice invito valido per scaricare il PDF.',
        403,
        'missing'
      );
    }

    const record = await this.store.getByCode(code);
    // Allow PDF download even when remainingGenerations === 0 after the final generation.
    this.assertUsableRecord(record, this.now(), {
      requireRemainingQuota: false,
    });
  }

  async reserveGeneration(
    req: HttpCookieRequest,
    isAdmin: boolean
  ): Promise<InviteReservation | null> {
    if (isAdmin || !this.config.betaInviteRequired) {
      return null;
    }

    const code = this.verifyCookieFromRequest(req);
    if (!code) {
      throw new BetaAccessError(
        'Accesso riservato agli invitati. Inserisci il tuo codice invito per continuare.',
        403,
        'missing'
      );
    }

    const updated = await this.store.consumeGeneration(code, this.now());
    return {
      code: updated.code,
      inviteQuota: toQuota(updated),
    };
  }

  async refundGeneration(reservation: InviteReservation | null): Promise<void> {
    if (!reservation) return;
    await this.store.refundGeneration(reservation.code);
  }

  async listInvites(): Promise<BetaInviteSummary[]> {
    const nowMs = this.now();
    const records = await this.store.listAll();
    return records.map((record) => toSummary(record, nowMs));
  }

  async createInvite(
    input: CreateInviteRequest,
    createdByEmail: string
  ): Promise<BetaInviteSummary> {
    const label = typeof input.label === 'string' ? input.label.trim() : '';
    if (!label || label.length > 60) {
      throw new BetaAccessError(
        'Inserisci un nome valido per l’invito (1–60 caratteri).',
        400,
        'validation'
      );
    }

    const maxGenerations = Math.trunc(Number(input.maxGenerations));
    if (
      !Number.isFinite(maxGenerations) ||
      maxGenerations < 1 ||
      maxGenerations > 1000
    ) {
      throw new BetaAccessError(
        'Il numero massimo di generazioni deve essere compreso tra 1 e 1000.',
        400,
        'validation'
      );
    }

    let code = normalizeCode(input.code);
    if (code) {
      if (!CODE_PATTERN.test(code)) {
        throw new BetaAccessError(
          'Il codice deve avere tra 4 e 32 caratteri alfanumerici o trattini (es. LUCA-2026).',
          400,
          'validation'
        );
      }
    } else {
      code = generateInviteCode();
    }

    const nowMs = this.now();
    let expiresAtMs: number | null = null;
    if (typeof input.expiresAtMs === 'number' && Number.isFinite(input.expiresAtMs)) {
      if (input.expiresAtMs <= nowMs) {
        throw new BetaAccessError(
          'La data di scadenza deve essere futura.',
          400,
          'validation'
        );
      }
      expiresAtMs = Math.trunc(input.expiresAtMs);
    } else if (
      input.expiresInDays !== undefined &&
      input.expiresInDays !== null
    ) {
      const days = Number(input.expiresInDays);
      if (!Number.isFinite(days) || days <= 0 || days > 365) {
        throw new BetaAccessError(
          'La durata dell’invito deve essere compresa tra 1 e 365 giorni.',
          400,
          'validation'
        );
      }
      expiresAtMs = Math.round(nowMs + days * DAY_MS);
    }

    const created = await this.store.create({
      code,
      label,
      maxGenerations,
      usedGenerations: 0,
      expiresAtMs,
      active: true,
      createdAtMs: nowMs,
      createdByEmail,
      lastUsedAtMs: null,
    });

    return toSummary(created, nowMs);
  }

  async updateInvite(
    rawCode: string,
    input: UpdateInviteRequest
  ): Promise<BetaInviteSummary> {
    const code = normalizeCode(rawCode);
    if (!CODE_PATTERN.test(code)) {
      throw new BetaAccessError('Codice invito non valido.', 400, 'validation');
    }

    const patch: {
      active?: boolean;
      maxGenerations?: number;
      expiresAtMs?: number | null;
    } = {};

    if (input.active !== undefined) {
      patch.active = Boolean(input.active);
    }

    if (input.maxGenerations !== undefined) {
      const maxGen = Math.trunc(Number(input.maxGenerations));
      if (!Number.isFinite(maxGen) || maxGen < 1 || maxGen > 1000) {
        throw new BetaAccessError(
          'Il numero massimo di generazioni deve essere compreso tra 1 e 1000.',
          400,
          'validation'
        );
      }
      patch.maxGenerations = maxGen;
    }

    if (input.expiresAtMs !== undefined) {
      patch.expiresAtMs =
        input.expiresAtMs === null ? null : Math.trunc(Number(input.expiresAtMs));
    }

    const updated = await this.store.update(code, patch);
    if (!updated) {
      throw new BetaAccessError('Invito non trovato.', 404, 'invalid');
    }

    return toSummary(updated, this.now());
  }

  async deleteInvite(rawCode: string): Promise<void> {
    const code = normalizeCode(rawCode);
    if (!CODE_PATTERN.test(code)) {
      throw new BetaAccessError('Codice invito non valido.', 400, 'validation');
    }

    const deleted = await this.store.delete(code);
    if (!deleted) {
      throw new BetaAccessError('Invito non trovato.', 404, 'invalid');
    }
  }
}
