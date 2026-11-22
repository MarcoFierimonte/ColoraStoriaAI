import {
  BetaAccessError,
  type BetaInvitePatch,
  type BetaInviteRecord,
  type BetaInviteStore,
} from '../betaAccess.interface.ts';

export class InMemoryBetaInviteStore implements BetaInviteStore {
  private readonly records = new Map<string, BetaInviteRecord>();

  async getByCode(code: string): Promise<BetaInviteRecord | null> {
    const found = this.records.get(code);
    return found ? { ...found } : null;
  }

  async listAll(): Promise<BetaInviteRecord[]> {
    return [...this.records.values()]
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .map((item) => ({ ...item }));
  }

  async create(record: BetaInviteRecord): Promise<BetaInviteRecord> {
    if (this.records.has(record.code)) {
      throw new BetaAccessError(
        `Esiste già un invito con il codice "${record.code}".`,
        409,
        'conflict'
      );
    }
    const copy = { ...record };
    this.records.set(copy.code, copy);
    return { ...copy };
  }

  async update(
    code: string,
    patch: BetaInvitePatch
  ): Promise<BetaInviteRecord | null> {
    const existing = this.records.get(code);
    if (!existing) {
      return null;
    }

    const updated: BetaInviteRecord = {
      ...existing,
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.maxGenerations !== undefined
        ? { maxGenerations: patch.maxGenerations }
        : {}),
      ...(patch.expiresAtMs !== undefined
        ? { expiresAtMs: patch.expiresAtMs }
        : {}),
    };
    this.records.set(code, updated);
    return { ...updated };
  }

  async delete(code: string): Promise<boolean> {
    return this.records.delete(code);
  }

  async consumeGeneration(
    code: string,
    nowMs: number
  ): Promise<BetaInviteRecord> {
    const record = this.records.get(code);
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
    if (record.usedGenerations >= record.maxGenerations) {
      throw new BetaAccessError(
        'Hai già utilizzato tutte le generazioni incluse in questo invito.',
        403,
        'exhausted'
      );
    }

    const updated: BetaInviteRecord = {
      ...record,
      usedGenerations: record.usedGenerations + 1,
      lastUsedAtMs: nowMs,
    };
    this.records.set(code, updated);
    return { ...updated };
  }

  async refundGeneration(code: string): Promise<void> {
    const record = this.records.get(code);
    if (!record || record.usedGenerations <= 0) return;
    this.records.set(code, {
      ...record,
      usedGenerations: Math.max(0, record.usedGenerations - 1),
    });
  }
}
