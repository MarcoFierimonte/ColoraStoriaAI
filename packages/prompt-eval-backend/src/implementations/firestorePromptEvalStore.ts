import fs from 'node:fs';
import path from 'node:path';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type {
  PromptEvalItem,
  PromptEvalItemEvaluation,
  PromptEvalRunDetail,
  PromptEvalRunEvaluation,
  PromptEvalRunSummary,
} from '../../../prompt-eval-core/src/index.ts';
import type { PromptEvalStore } from '../promptEval.interface.ts';

const RUNS_COLLECTION = 'prompt_eval_runs';
const ITEMS_SUBCOLLECTION = 'items';
const MAX_FIRESTORE_BATCH_OPS = 450;
const DEFAULT_EMAIL_CLAIM_LEASE_MS = 120_000;

interface FirebaseAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => stripUndefined(entry)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        out[key] = stripUndefined(val);
      }
    }
    return out as T;
  }
  return value;
}

function normalizeRunSummary(
  docId: string,
  raw: FirebaseFirestore.DocumentData
): PromptEvalRunSummary {
  const promptParams: Record<string, string> = {};
  if (raw.promptParams && typeof raw.promptParams === 'object') {
    for (const [k, v] of Object.entries(
      raw.promptParams as Record<string, unknown>
    )) {
      promptParams[k] = String(v ?? '');
    }
  }

  const promptMetadata: Record<string, string> = {};
  if (raw.promptMetadata && typeof raw.promptMetadata === 'object') {
    for (const [k, v] of Object.entries(
      raw.promptMetadata as Record<string, unknown>
    )) {
      promptMetadata[k] = String(v ?? '');
    }
  }

  const evaluation =
    raw.evaluation && typeof raw.evaluation === 'object'
      ? {
          overallRating:
            typeof raw.evaluation.overallRating === 'number'
              ? raw.evaluation.overallRating
              : null,
          notes: String(raw.evaluation.notes ?? ''),
          tags: Array.isArray(raw.evaluation.tags)
            ? raw.evaluation.tags.map((tag: unknown) => String(tag))
            : [],
          updatedAtMs: Number(raw.evaluation.updatedAtMs ?? 0),
        }
      : undefined;

  return {
    id: String(raw.id ?? docId),
    title: String(raw.title ?? ''),
    createdByUid: String(raw.createdByUid ?? ''),
    createdByEmail: String(raw.createdByEmail ?? ''),
    modality: raw.modality === 'text' ? 'text' : 'image',
    executionMode: raw.executionMode === 'batch' ? 'batch' : 'standard',
    providerId: String(raw.providerId ?? ''),
    model: String(raw.model ?? ''),
    promptSource: raw.promptSource === 'custom' ? 'custom' : 'catalog',
    catalogId: typeof raw.catalogId === 'string' ? raw.catalogId : null,
    promptLabel: String(raw.promptLabel ?? ''),
    promptText: String(raw.promptText ?? ''),
    promptParams,
    promptMetadata,
    status: (raw.status ?? 'queued') as PromptEvalRunSummary['status'],
    totalItems: Number(raw.totalItems ?? 0),
    completedItems: Number(raw.completedItems ?? 0),
    failedItems: Number(raw.failedItems ?? 0),
    totalEstimatedCostUsd: Number(raw.totalEstimatedCostUsd ?? 0),
    totalInputTokens: Number(raw.totalInputTokens ?? 0),
    totalOutputTokens: Number(raw.totalOutputTokens ?? 0),
    externalBatchJobId:
      typeof raw.externalBatchJobId === 'string'
        ? raw.externalBatchJobId
        : null,
    externalBatchState:
      typeof raw.externalBatchState === 'string'
        ? raw.externalBatchState
        : null,
    notifyEmail: typeof raw.notifyEmail === 'string' ? raw.notifyEmail : null,
    notificationStatus: (raw.notificationStatus ??
      'not_requested') as PromptEvalRunSummary['notificationStatus'],
    notificationSentAtMs:
      typeof raw.notificationSentAtMs === 'number'
        ? raw.notificationSentAtMs
        : null,
    notificationError:
      typeof raw.notificationError === 'string' ? raw.notificationError : null,
    evaluation,
    createdAtMs: Number(raw.createdAtMs ?? 0),
    updatedAtMs: Number(raw.updatedAtMs ?? 0),
    completedAtMs:
      typeof raw.completedAtMs === 'number' ? raw.completedAtMs : null,
    errorMessage:
      typeof raw.errorMessage === 'string' ? raw.errorMessage : null,
  };
}

function normalizeRunItem(
  docId: string,
  raw: FirebaseFirestore.DocumentData
): PromptEvalItem {
  return {
    id: String(raw.id ?? docId),
    index: Number(raw.index ?? 0),
    inputName: String(raw.inputName ?? ''),
    inputMimeType:
      typeof raw.inputMimeType === 'string' ? raw.inputMimeType : undefined,
    inputWidth: typeof raw.inputWidth === 'number' ? raw.inputWidth : undefined,
    inputHeight:
      typeof raw.inputHeight === 'number' ? raw.inputHeight : undefined,
    inputText: typeof raw.inputText === 'string' ? raw.inputText : undefined,
    inputThumbnailDataUrl:
      typeof raw.inputThumbnailDataUrl === 'string'
        ? raw.inputThumbnailDataUrl
        : undefined,
    status: (raw.status ?? 'pending') as PromptEvalItem['status'],
    outputFormat:
      raw.outputFormat === 'raster' ||
      raw.outputFormat === 'svg' ||
      raw.outputFormat === 'text'
        ? raw.outputFormat
        : undefined,
    outputImageDataUrl:
      typeof raw.outputImageDataUrl === 'string'
        ? raw.outputImageDataUrl
        : undefined,
    outputText: typeof raw.outputText === 'string' ? raw.outputText : undefined,
    errorMessage:
      typeof raw.errorMessage === 'string' ? raw.errorMessage : undefined,
    latencyMs: typeof raw.latencyMs === 'number' ? raw.latencyMs : undefined,
    usage:
      raw.usage && typeof raw.usage === 'object'
        ? {
            inputTokens: Number(raw.usage.inputTokens ?? 0),
            cachedInputTokens: Number(raw.usage.cachedInputTokens ?? 0),
            textOutputTokens: Number(raw.usage.textOutputTokens ?? 0),
            imageOutputTokens: Number(raw.usage.imageOutputTokens ?? 0),
            estimatedCostUsd: Number(raw.usage.estimatedCostUsd ?? 0),
            batchDiscountApplied: Boolean(raw.usage.batchDiscountApplied),
          }
        : undefined,
    evaluation:
      raw.evaluation && typeof raw.evaluation === 'object'
        ? {
            rating:
              typeof raw.evaluation.rating === 'number'
                ? raw.evaluation.rating
                : null,
            verdict:
              raw.evaluation.verdict === 'pass' ||
              raw.evaluation.verdict === 'needs_work' ||
              raw.evaluation.verdict === 'fail'
                ? raw.evaluation.verdict
                : null,
            notes: String(raw.evaluation.notes ?? ''),
            updatedAtMs: Number(raw.evaluation.updatedAtMs ?? 0),
          }
        : undefined,
    completedAtMs:
      typeof raw.completedAtMs === 'number' ? raw.completedAtMs : undefined,
  };
}

export interface FirestorePromptEvalStoreOptions {
  db?: Firestore;
  firebaseConfigPath?: string;
  projectId?: string;
  databaseId?: string;
  collectionName?: string;
}

export class FirestorePromptEvalStore implements PromptEvalStore {
  private readonly firebaseConfigPath?: string;
  private readonly explicitProjectId?: string;
  private readonly explicitDatabaseId?: string;
  private readonly collectionName: string;
  private cachedDb: Firestore | null = null;

  constructor(options: FirestorePromptEvalStoreOptions = {}) {
    this.cachedDb = options.db ?? null;
    this.firebaseConfigPath = options.firebaseConfigPath;
    this.explicitProjectId = options.projectId;
    this.explicitDatabaseId = options.databaseId;
    this.collectionName = options.collectionName ?? RUNS_COLLECTION;
  }

  private getDb(): Firestore {
    if (this.cachedDb) {
      return this.cachedDb;
    }

    let projectId =
      this.explicitProjectId ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      '';
    let databaseId = this.explicitDatabaseId || '(default)';

    if (this.firebaseConfigPath && fs.existsSync(this.firebaseConfigPath)) {
      const raw = fs.readFileSync(path.resolve(this.firebaseConfigPath), 'utf8');
      const parsed = JSON.parse(raw) as FirebaseAppletConfig;
      if (!this.explicitProjectId && parsed.projectId) {
        projectId = parsed.projectId;
      }
      if (!this.explicitDatabaseId && parsed.firestoreDatabaseId) {
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

  async createRun(run: PromptEvalRunDetail): Promise<PromptEvalRunDetail> {
    const db = this.getDb();
    const { items, ...summary } = run;
    const runRef = db.collection(this.collectionName).doc(run.id);

    const firstChunkSize = MAX_FIRESTORE_BATCH_OPS - 1;
    const firstBatch = db.batch();
    firstBatch.set(runRef, stripUndefined(summary));
    for (const item of items.slice(0, firstChunkSize)) {
      const itemRef = runRef.collection(ITEMS_SUBCOLLECTION).doc(item.id);
      firstBatch.set(itemRef, stripUndefined(item));
    }
    await firstBatch.commit();

    for (let offset = firstChunkSize; offset < items.length; offset += MAX_FIRESTORE_BATCH_OPS) {
      const chunkBatch = db.batch();
      for (const item of items.slice(offset, offset + MAX_FIRESTORE_BATCH_OPS)) {
        const itemRef = runRef.collection(ITEMS_SUBCOLLECTION).doc(item.id);
        chunkBatch.set(itemRef, stripUndefined(item));
      }
      await chunkBatch.commit();
    }

    return run;
  }

  async getRun(runId: string): Promise<PromptEvalRunDetail | null> {
    const db = this.getDb();
    const runRef = db.collection(this.collectionName).doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) return null;

    const summary = normalizeRunSummary(runSnap.id, runSnap.data() ?? {});
    const itemsSnap = await runRef
      .collection(ITEMS_SUBCOLLECTION)
      .orderBy('index', 'asc')
      .get();
    const items = itemsSnap.docs.map((doc) =>
      normalizeRunItem(doc.id, doc.data())
    );

    return {
      ...summary,
      items,
    };
  }

  async listRuns(limit = 50): Promise<PromptEvalRunSummary[]> {
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    const snapshot = await this.getDb()
      .collection(this.collectionName)
      .orderBy('createdAtMs', 'desc')
      .limit(safeLimit)
      .get();

    return snapshot.docs.map((doc) => normalizeRunSummary(doc.id, doc.data()));
  }

  async listActiveBatchRuns(): Promise<PromptEvalRunSummary[]> {
    // Query only active statuses (single-field automatic index, zero composite index required)
    // to minimize Firestore free-tier document reads on periodic polling.
    const snapshot = await this.getDb()
      .collection(this.collectionName)
      .where('status', 'in', ['queued', 'running'])
      .get();

    return snapshot.docs
      .map((doc) => normalizeRunSummary(doc.id, doc.data()))
      .filter(
        (run) =>
          run.executionMode === 'batch' &&
          (run.status === 'queued' || run.status === 'running') &&
          Boolean(run.externalBatchJobId)
      )
      .sort((a, b) => a.createdAtMs - b.createdAtMs);
  }

  async updateRunSummary(
    runId: string,
    patch: Partial<PromptEvalRunSummary>
  ): Promise<PromptEvalRunSummary | null> {
    const runRef = this.getDb().collection(this.collectionName).doc(runId);
    const snap = await runRef.get();
    if (!snap.exists) return null;

    const cleanPatch = stripUndefined({ ...patch }) as Record<string, unknown>;
    delete cleanPatch.id;
    if (
      patch.notificationStatus === 'sent' ||
      patch.notificationStatus === 'failed' ||
      patch.notificationStatus === 'not_requested'
    ) {
      cleanPatch.notificationClaimedAtMs = null;
    }
    if (Object.keys(cleanPatch).length > 0) {
      await runRef.set(cleanPatch, { merge: true });
    }

    const updatedSnap = await runRef.get();
    return normalizeRunSummary(updatedSnap.id, updatedSnap.data() ?? {});
  }

  async upsertRunItem(runId: string, item: PromptEvalItem): Promise<void> {
    const itemRef = this.getDb()
      .collection(this.collectionName)
      .doc(runId)
      .collection(ITEMS_SUBCOLLECTION)
      .doc(item.id);
    await itemRef.set(stripUndefined(item), { merge: true });
  }

  async updateRunEvaluation(
    runId: string,
    evaluation: PromptEvalRunEvaluation
  ): Promise<PromptEvalRunDetail | null> {
    const runRef = this.getDb().collection(this.collectionName).doc(runId);
    const snap = await runRef.get();
    if (!snap.exists) return null;

    await runRef.set(
      stripUndefined({
        evaluation,
        updatedAtMs: evaluation.updatedAtMs,
      }),
      { merge: true }
    );

    return this.getRun(runId);
  }

  async updateItemEvaluation(
    runId: string,
    itemId: string,
    evaluation: PromptEvalItemEvaluation
  ): Promise<PromptEvalRunDetail | null> {
    const runRef = this.getDb().collection(this.collectionName).doc(runId);
    const itemRef = runRef.collection(ITEMS_SUBCOLLECTION).doc(itemId);
    const [runSnap, itemSnap] = await Promise.all([runRef.get(), itemRef.get()]);
    if (!runSnap.exists || !itemSnap.exists) return null;

    const batch = this.getDb().batch();
    batch.set(itemRef, stripUndefined({ evaluation }), { merge: true });
    batch.set(runRef, { updatedAtMs: evaluation.updatedAtMs }, { merge: true });
    await batch.commit();

    return this.getRun(runId);
  }

  async claimEmailNotification(
    runId: string,
    recipient: string,
    nowMs: number,
    leaseMs = DEFAULT_EMAIL_CLAIM_LEASE_MS
  ): Promise<boolean> {
    const db = this.getDb();
    const runRef = db.collection(this.collectionName).doc(runId);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(runRef);
      if (!snap.exists) return false;
      const data = snap.data() ?? {};
      if (data.notificationStatus === 'sent') {
        return false;
      }
      const claimedAt =
        typeof data.notificationClaimedAtMs === 'number'
          ? data.notificationClaimedAtMs
          : 0;
      if (claimedAt > 0 && nowMs - claimedAt < leaseMs) {
        return false;
      }
      tx.set(
        runRef,
        {
          notifyEmail: recipient,
          notificationClaimedAtMs: nowMs,
        },
        { merge: true }
      );
      return true;
    });
  }

  async deleteRun(runId: string): Promise<boolean> {
    const db = this.getDb();
    const runRef = db.collection(this.collectionName).doc(runId);
    const snap = await runRef.get();
    if (!snap.exists) return false;

    const itemsSnap = await runRef.collection(ITEMS_SUBCOLLECTION).get();
    const itemRefs = itemsSnap.docs.map((doc) => doc.ref);

    for (let offset = 0; offset < itemRefs.length; offset += MAX_FIRESTORE_BATCH_OPS) {
      const slice = itemRefs.slice(offset, offset + MAX_FIRESTORE_BATCH_OPS);
      const batch = db.batch();
      for (const ref of slice) {
        batch.delete(ref);
      }
      const isLastSlice = offset + MAX_FIRESTORE_BATCH_OPS >= itemRefs.length;
      if (isLastSlice && slice.length < MAX_FIRESTORE_BATCH_OPS) {
        batch.delete(runRef);
        await batch.commit();
        return true;
      }
      await batch.commit();
    }

    await runRef.delete();
    return true;
  }
}
