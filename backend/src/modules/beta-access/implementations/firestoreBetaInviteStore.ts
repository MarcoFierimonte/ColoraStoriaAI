import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  BetaAccessError,
  type BetaInvitePatch,
  type BetaInviteRecord,
  type BetaInviteStore,
} from '../betaAccess.interface.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_FIREBASE_CONFIG_PATH = path.resolve(
  __dirname,
  '../../../../../firebase-applet-config.json'
);
const COLLECTION_NAME = 'beta_invites';

interface FirebaseAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function normalizeRecord(raw: FirebaseFirestore.DocumentData): BetaInviteRecord {
  return {
    code: String(raw.code ?? ''),
    label: String(raw.label ?? ''),
    maxGenerations: Number(raw.maxGenerations ?? 0),
    usedGenerations: Number(raw.usedGenerations ?? 0),
    expiresAtMs:
      typeof raw.expiresAtMs === 'number' && Number.isFinite(raw.expiresAtMs)
        ? raw.expiresAtMs
        : null,
    active: Boolean(raw.active),
    createdAtMs: Number(raw.createdAtMs ?? 0),
    createdByEmail: String(raw.createdByEmail ?? ''),
    lastUsedAtMs:
      typeof raw.lastUsedAtMs === 'number' && Number.isFinite(raw.lastUsedAtMs)
        ? raw.lastUsedAtMs
        : null,
  };
}

export class FirestoreBetaInviteStore implements BetaInviteStore {
  private readonly firebaseConfigPath: string;
  private cachedDb: Firestore | null = null;

  constructor(firebaseConfigPath = DEFAULT_FIREBASE_CONFIG_PATH) {
    this.firebaseConfigPath = firebaseConfigPath;
  }

  private getDb(): Firestore {
    if (this.cachedDb) {
      return this.cachedDb;
    }

    let projectId =
      process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';
    let databaseId = '(default)';

    if (fs.existsSync(this.firebaseConfigPath)) {
      const raw = fs.readFileSync(this.firebaseConfigPath, 'utf8');
      const parsed = JSON.parse(raw) as FirebaseAppletConfig;
      if (parsed.projectId) {
        projectId = parsed.projectId;
      }
      if (parsed.firestoreDatabaseId) {
        databaseId = parsed.firestoreDatabaseId;
      }
    }

    const apps = getApps();
    const app: App =
      apps.length > 0
        ? apps[0]
        : initializeApp(projectId ? { projectId } : undefined);

    this.cachedDb =
      databaseId && databaseId !== '(default)'
        ? getFirestore(app, databaseId)
        : getFirestore(app);

    return this.cachedDb;
  }

  async getByCode(code: string): Promise<BetaInviteRecord | null> {
    const doc = await this.getDb().collection(COLLECTION_NAME).doc(code).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return data ? normalizeRecord(data) : null;
  }

  async listAll(): Promise<BetaInviteRecord[]> {
    const snapshot = await this.getDb()
      .collection(COLLECTION_NAME)
      .orderBy('createdAtMs', 'desc')
      .get();

    return snapshot.docs.map((doc) => normalizeRecord(doc.data()));
  }

  async create(record: BetaInviteRecord): Promise<BetaInviteRecord> {
    const db = this.getDb();
    const docRef = db.collection(COLLECTION_NAME).doc(record.code);

    await db.runTransaction(async (tx) => {
      const existing = await tx.get(docRef);
      if (existing.exists) {
        throw new BetaAccessError(
          `Esiste già un invito con il codice "${record.code}".`,
          409,
          'conflict'
        );
      }
      tx.set(docRef, { ...record });
    });

    return { ...record };
  }

  async update(
    code: string,
    patch: BetaInvitePatch
  ): Promise<BetaInviteRecord | null> {
    const db = this.getDb();
    const docRef = db.collection(COLLECTION_NAME).doc(code);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        return null;
      }
      const current = normalizeRecord(snap.data() ?? {});
      const updated: BetaInviteRecord = {
        ...current,
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.maxGenerations !== undefined
          ? { maxGenerations: patch.maxGenerations }
          : {}),
        ...(patch.expiresAtMs !== undefined
          ? { expiresAtMs: patch.expiresAtMs }
          : {}),
      };

      const updateFields: Partial<BetaInviteRecord> = {};
      if (patch.active !== undefined) updateFields.active = updated.active;
      if (patch.maxGenerations !== undefined) {
        updateFields.maxGenerations = updated.maxGenerations;
      }
      if (patch.expiresAtMs !== undefined) {
        updateFields.expiresAtMs = updated.expiresAtMs;
      }

      if (Object.keys(updateFields).length > 0) {
        tx.update(docRef, updateFields);
      }

      return updated;
    });
  }

  async delete(code: string): Promise<boolean> {
    const docRef = this.getDb().collection(COLLECTION_NAME).doc(code);
    const snap = await docRef.get();
    if (!snap.exists) {
      return false;
    }
    await docRef.delete();
    return true;
  }

  async consumeGeneration(
    code: string,
    nowMs: number
  ): Promise<BetaInviteRecord> {
    const db = this.getDb();
    const docRef = db.collection(COLLECTION_NAME).doc(code);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        throw new BetaAccessError(
          'Codice invito non valido.',
          403,
          'invalid'
        );
      }

      const record = normalizeRecord(snap.data() ?? {});
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
      tx.update(docRef, {
        usedGenerations: updated.usedGenerations,
        lastUsedAtMs: updated.lastUsedAtMs,
      });

      return updated;
    });
  }

  async refundGeneration(code: string): Promise<void> {
    const db = this.getDb();
    const docRef = db.collection(COLLECTION_NAME).doc(code);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return;
      const current = normalizeRecord(snap.data() ?? {});
      if (current.usedGenerations <= 0) return;
      tx.update(docRef, {
        usedGenerations: Math.max(0, current.usedGenerations - 1),
      });
    });
  }
}
