import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import {
  Timestamp,
  getFirestore,
  type Firestore,
} from 'firebase-admin/firestore';
import {
  isAllowedThemeId,
  type AdminTelemetry,
  type AdminTelemetryLogRecord,
  type ColoringOutputFormat,
  type GenerationLogExecutionMode,
  type GenerationLogSource,
  type GenerationLogThemeId,
  type ProviderId,
} from '../../../../../shared/types/index.ts';
import type {
  PromptEvalStore,
  PromptEvalTelemetryEntry,
  PromptEvalTelemetryRecorder,
} from '../../../../../packages/prompt-eval-backend/src/index.ts';

const GENERATION_LOGS_COLLECTION = 'generation_logs';
const RUNS_COLLECTION = 'prompt_eval_runs';
const SAFE_DOC_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

interface FirebaseAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

export interface CreatorGenerationTelemetryInput {
  adminUid: string;
  themeId: GenerationLogThemeId;
  telemetry: AdminTelemetry;
  createdAtMs?: number;
}

export interface AdminGenerationTelemetryService
  extends PromptEvalTelemetryRecorder {
  recordCreatorGeneration(
    input: CreatorGenerationTelemetryInput
  ): Promise<string>;
  listLogsForAdmin(
    adminUid: string,
    limit?: number
  ): Promise<AdminTelemetryLogRecord[]>;
  deleteLogForAdmin(logId: string, adminUid: string): Promise<boolean>;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Number(value.toFixed(6))));
}

function resolvePromptEvalThemeId(
  entry: PromptEvalTelemetryEntry
): GenerationLogThemeId {
  if (entry.promptParams.mode === 'creativa') {
    const candidate = entry.promptParams.themeId ?? '';
    if (isAllowedThemeId(candidate)) {
      return candidate;
    }
  }
  return 'fedele';
}

function resolvePromptEvalVersion(entry: PromptEvalTelemetryEntry): string {
  if (entry.promptSource === 'custom') {
    return 'custom';
  }
  const raw =
    entry.promptMetadata.promptVersion || entry.promptParams.version || 'v3';
  return /^v[0-9]+$/.test(raw) ? raw.slice(0, 20) : 'custom';
}

function resolveProviderId(raw: string): ProviderId {
  return raw === 'openai' ? 'openai' : 'gemini';
}

function resolveOutputFormat(
  raw: string | undefined,
  modality: 'image' | 'text'
): ColoringOutputFormat | 'text' {
  if (modality === 'text' || raw === 'text') return 'text';
  if (raw === 'svg') return 'svg';
  return 'raster';
}

function buildDeterministicPromptEvalLogId(
  runId: string,
  itemId: string
): string {
  const candidate = `pe_${runId}_${itemId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (candidate.length <= 120) {
    return candidate;
  }
  const digest = crypto
    .createHash('sha1')
    .update(`${runId}:${itemId}`)
    .digest('hex')
    .slice(0, 16);
  return `${candidate.slice(0, 100)}_${digest}`;
}

function mapPromptEvalEntryToRecord(
  entry: PromptEvalTelemetryEntry,
  overrideAdminUid?: string
): AdminTelemetryLogRecord {
  const id = buildDeterministicPromptEvalLogId(entry.runId, entry.itemId);
  const adminUid = (overrideAdminUid || entry.actorUid || 'admin').slice(
    0,
    128
  );
  return {
    id,
    adminUid,
    source: 'prompt_lab',
    executionMode: entry.executionMode,
    batchDiscountApplied: Boolean(entry.usage.batchDiscountApplied),
    runId: entry.runId.slice(0, 128),
    runTitle: entry.runTitle.slice(0, 120),
    inputName: entry.inputName.slice(0, 120),
    provider: resolveProviderId(entry.providerId),
    model: entry.model.slice(0, 80) || 'unknown',
    promptVersion: resolvePromptEvalVersion(entry),
    themeId: resolvePromptEvalThemeId(entry),
    outputFormat: resolveOutputFormat(entry.outputFormat, entry.modality),
    inputTokens: clampInt(entry.usage.inputTokens, 0, 1_000_000),
    cachedInputTokens: clampInt(entry.usage.cachedInputTokens, 0, 1_000_000),
    textOutputTokens: clampInt(entry.usage.textOutputTokens, 0, 1_000_000),
    imageOutputTokens: clampInt(entry.usage.imageOutputTokens, 0, 1_000_000),
    estimatedCostUsd: clampFloat(entry.usage.estimatedCostUsd, 0, 100),
    latencyMs: clampInt(entry.latencyMs, 0, 600_000),
    createdAtMs: entry.completedAtMs,
  };
}

export class InMemoryGenerationTelemetryService
  implements AdminGenerationTelemetryService
{
  private readonly records = new Map<string, AdminTelemetryLogRecord>();
  private readonly syncedRunIds = new Set<string>();
  private readonly evalStore?: PromptEvalStore;

  constructor(options?: { evalStore?: PromptEvalStore }) {
    this.evalStore = options?.evalStore;
  }

  async recordCompletedItems(
    entries: PromptEvalTelemetryEntry[]
  ): Promise<void> {
    for (const entry of entries) {
      const record = mapPromptEvalEntryToRecord(entry);
      this.records.set(record.id, record);
      this.syncedRunIds.add(entry.runId);
    }
  }

  async recordCreatorGeneration(
    input: CreatorGenerationTelemetryInput
  ): Promise<string> {
    const id = `gen_${Date.now().toString(36)}_${crypto
      .randomBytes(4)
      .toString('hex')}`;
    const safePromptVersion = /^v[0-9]+$/.test(input.telemetry.promptVersion)
      ? input.telemetry.promptVersion.slice(0, 20)
      : 'v1';

    const record: AdminTelemetryLogRecord = {
      id,
      adminUid: input.adminUid.slice(0, 128),
      source: 'creator',
      executionMode: 'standard',
      provider: input.telemetry.provider,
      model: input.telemetry.model.slice(0, 80) || 'unknown',
      promptVersion: safePromptVersion,
      themeId: input.themeId,
      outputFormat: input.telemetry.outputFormat,
      inputTokens: clampInt(input.telemetry.inputTokens, 0, 1_000_000),
      cachedInputTokens: clampInt(
        input.telemetry.cachedInputTokens,
        0,
        1_000_000
      ),
      textOutputTokens: clampInt(
        input.telemetry.textOutputTokens,
        0,
        1_000_000
      ),
      imageOutputTokens: clampInt(
        input.telemetry.imageOutputTokens,
        0,
        1_000_000
      ),
      estimatedCostUsd: clampFloat(input.telemetry.estimatedCostUsd, 0, 100),
      latencyMs: clampInt(input.telemetry.latencyMs, 0, 600_000),
      createdAtMs: input.createdAtMs ?? Date.now(),
    };

    this.records.set(id, record);
    return id;
  }

  private async backfillFromEvalStore(adminUid: string): Promise<void> {
    if (!this.evalStore) return;
    const summaries = await this.evalStore.listRuns(100);
    for (const summary of summaries) {
      if (this.syncedRunIds.has(summary.id)) continue;
      if (summary.status !== 'completed' && summary.status !== 'partial') {
        continue;
      }
      if (
        summary.createdByUid !== adminUid &&
        summary.createdByUid !== 'admin'
      ) {
        continue;
      }
      const detail = await this.evalStore.getRun(summary.id);
      if (!detail) continue;

      for (const item of detail.items) {
        if (item.status !== 'completed' || !item.usage) continue;
        const record = mapPromptEvalEntryToRecord(
          {
            runId: detail.id,
            runTitle: detail.title,
            itemId: item.id,
            inputName: item.inputName,
            actorUid: detail.createdByUid,
            actorEmail: detail.createdByEmail,
            modality: detail.modality,
            executionMode: detail.executionMode,
            providerId: detail.providerId,
            model: detail.model,
            promptSource: detail.promptSource,
            promptParams: detail.promptParams,
            promptMetadata: detail.promptMetadata,
            outputFormat: item.outputFormat,
            latencyMs: item.latencyMs ?? 0,
            usage: item.usage,
            completedAtMs:
              item.completedAtMs ?? detail.completedAtMs ?? detail.updatedAtMs,
          },
          summary.createdByUid === 'admin' ? adminUid : undefined
        );
        this.records.set(record.id, record);
      }
      this.syncedRunIds.add(summary.id);
    }
  }

  async listLogsForAdmin(
    adminUid: string,
    limit = 100
  ): Promise<AdminTelemetryLogRecord[]> {
    await this.backfillFromEvalStore(adminUid);
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    return [...this.records.values()]
      .filter((r) => r.adminUid === adminUid || r.adminUid === 'admin')
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
      .slice(0, safeLimit);
  }

  async deleteLogForAdmin(logId: string, adminUid: string): Promise<boolean> {
    if (!SAFE_DOC_ID_PATTERN.test(logId)) return false;
    const existing = this.records.get(logId);
    if (!existing) return false;
    if (existing.adminUid !== adminUid && existing.adminUid !== 'admin') {
      return false;
    }
    return this.records.delete(logId);
  }
}

export interface FirestoreGenerationTelemetryServiceOptions {
  db?: Firestore;
  firebaseConfigPath?: string;
  projectId?: string;
  databaseId?: string;
  evalStore?: PromptEvalStore;
}

export class FirestoreGenerationTelemetryService
  implements AdminGenerationTelemetryService
{
  private readonly firebaseConfigPath?: string;
  private readonly explicitProjectId?: string;
  private readonly explicitDatabaseId?: string;
  private readonly evalStore?: PromptEvalStore;
  private cachedDb: Firestore | null = null;
  private readonly syncedRunsSessionCache = new Set<string>();

  constructor(options: FirestoreGenerationTelemetryServiceOptions = {}) {
    this.cachedDb = options.db ?? null;
    this.firebaseConfigPath = options.firebaseConfigPath;
    this.explicitProjectId = options.projectId;
    this.explicitDatabaseId = options.databaseId;
    this.evalStore = options.evalStore;
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

  private serializeRecordForFirestore(
    record: AdminTelemetryLogRecord
  ): Record<string, unknown> {
    const createdAtMs = record.createdAtMs ?? Date.now();
    const doc: Record<string, unknown> = {
      adminUid: record.adminUid,
      source: record.source,
      executionMode: record.executionMode,
      provider: record.provider,
      model: record.model,
      promptVersion: record.promptVersion,
      themeId: record.themeId,
      outputFormat: record.outputFormat,
      inputTokens: record.inputTokens,
      cachedInputTokens: record.cachedInputTokens,
      textOutputTokens: record.textOutputTokens,
      imageOutputTokens: record.imageOutputTokens,
      estimatedCostUsd: record.estimatedCostUsd,
      latencyMs: record.latencyMs,
      createdAt: Timestamp.fromMillis(createdAtMs),
    };
    if (record.batchDiscountApplied !== undefined) {
      doc.batchDiscountApplied = record.batchDiscountApplied;
    }
    if (record.runId) doc.runId = record.runId;
    if (record.runTitle) doc.runTitle = record.runTitle;
    if (record.inputName) doc.inputName = record.inputName;
    return doc;
  }

  private normalizeDocToRecord(
    docId: string,
    data: FirebaseFirestore.DocumentData
  ): AdminTelemetryLogRecord {
    const rawCreatedAt = data.createdAt;
    let createdAtMs: number | null = null;
    if (rawCreatedAt && typeof rawCreatedAt.toMillis === 'function') {
      createdAtMs = rawCreatedAt.toMillis();
    } else if (typeof rawCreatedAt === 'number') {
      createdAtMs = rawCreatedAt;
    }

    const source: GenerationLogSource =
      data.source === 'prompt_lab' || docId.startsWith('pe_')
        ? 'prompt_lab'
        : 'creator';
    const executionMode: GenerationLogExecutionMode =
      data.executionMode === 'batch' ? 'batch' : 'standard';
    const outputFormat: ColoringOutputFormat | 'text' =
      data.outputFormat === 'text'
        ? 'text'
        : data.outputFormat === 'svg'
          ? 'svg'
          : 'raster';

    return {
      id: docId,
      adminUid: String(data.adminUid ?? ''),
      source,
      executionMode,
      batchDiscountApplied:
        typeof data.batchDiscountApplied === 'boolean'
          ? data.batchDiscountApplied
          : undefined,
      runId: typeof data.runId === 'string' ? data.runId : undefined,
      runTitle: typeof data.runTitle === 'string' ? data.runTitle : undefined,
      inputName:
        typeof data.inputName === 'string' ? data.inputName : undefined,
      provider: data.provider === 'openai' ? 'openai' : 'gemini',
      model: String(data.model ?? ''),
      promptVersion: String(data.promptVersion ?? 'v1'),
      themeId: isAllowedThemeId(String(data.themeId ?? ''))
        ? (data.themeId as GenerationLogThemeId)
        : 'fedele',
      outputFormat,
      inputTokens: Number(data.inputTokens ?? 0),
      cachedInputTokens: Number(data.cachedInputTokens ?? 0),
      textOutputTokens: Number(data.textOutputTokens ?? 0),
      imageOutputTokens: Number(data.imageOutputTokens ?? 0),
      estimatedCostUsd: Number(data.estimatedCostUsd ?? 0),
      latencyMs: Number(data.latencyMs ?? 0),
      createdAtMs,
    };
  }

  async recordCompletedItems(
    entries: PromptEvalTelemetryEntry[]
  ): Promise<void> {
    if (entries.length === 0) return;
    const db = this.getDb();
    const touchedRunIds = new Set<string>();

    for (let offset = 0; offset < entries.length; offset += 400) {
      const batch = db.batch();
      for (const entry of entries.slice(offset, offset + 400)) {
        const record = mapPromptEvalEntryToRecord(entry);
        const docRef = db
          .collection(GENERATION_LOGS_COLLECTION)
          .doc(record.id);
        batch.set(docRef, this.serializeRecordForFirestore(record), {
          merge: true,
        });
        touchedRunIds.add(entry.runId);
      }
      await batch.commit();
    }

    for (const runId of touchedRunIds) {
      this.syncedRunsSessionCache.add(runId);
      try {
        await db
          .collection(RUNS_COLLECTION)
          .doc(runId)
          .set({ telemetrySynced: true }, { merge: true });
      } catch {
        // Non-critical marker update
      }
    }
  }

  async recordCreatorGeneration(
    input: CreatorGenerationTelemetryInput
  ): Promise<string> {
    const db = this.getDb();
    const id = `gen_${Date.now().toString(36)}_${crypto
      .randomBytes(4)
      .toString('hex')}`;
    const safePromptVersion = /^v[0-9]+$/.test(input.telemetry.promptVersion)
      ? input.telemetry.promptVersion.slice(0, 20)
      : 'v1';

    const record: AdminTelemetryLogRecord = {
      id,
      adminUid: input.adminUid.slice(0, 128),
      source: 'creator',
      executionMode: 'standard',
      provider: input.telemetry.provider,
      model: input.telemetry.model.slice(0, 80) || 'unknown',
      promptVersion: safePromptVersion,
      themeId: input.themeId,
      outputFormat: input.telemetry.outputFormat,
      inputTokens: clampInt(input.telemetry.inputTokens, 0, 1_000_000),
      cachedInputTokens: clampInt(
        input.telemetry.cachedInputTokens,
        0,
        1_000_000
      ),
      textOutputTokens: clampInt(
        input.telemetry.textOutputTokens,
        0,
        1_000_000
      ),
      imageOutputTokens: clampInt(
        input.telemetry.imageOutputTokens,
        0,
        1_000_000
      ),
      estimatedCostUsd: clampFloat(input.telemetry.estimatedCostUsd, 0, 100),
      latencyMs: clampInt(input.telemetry.latencyMs, 0, 600_000),
      createdAtMs: input.createdAtMs ?? Date.now(),
    };

    await db
      .collection(GENERATION_LOGS_COLLECTION)
      .doc(id)
      .set(this.serializeRecordForFirestore(record));
    return id;
  }

  private async backfillUnsyncedPromptEvalRuns(
    adminUid: string
  ): Promise<void> {
    if (!this.evalStore) return;
    const db = this.getDb();

    let runSnap: FirebaseFirestore.QuerySnapshot;
    try {
      runSnap = await db
        .collection(RUNS_COLLECTION)
        .orderBy('createdAtMs', 'desc')
        .limit(50)
        .get();
    } catch {
      return;
    }

    for (const docSnap of runSnap.docs) {
      const runId = docSnap.id;
      if (this.syncedRunsSessionCache.has(runId)) continue;
      const raw = docSnap.data() ?? {};
      if (raw.telemetrySynced === true) {
        this.syncedRunsSessionCache.add(runId);
        continue;
      }
      const status = String(raw.status ?? '');
      if (status !== 'completed' && status !== 'partial') {
        continue;
      }
      const createdByUid = String(raw.createdByUid ?? '');
      if (createdByUid !== adminUid && createdByUid !== 'admin') {
        continue;
      }

      const detail = await this.evalStore.getRun(runId);
      if (!detail) continue;

      const entries: PromptEvalTelemetryEntry[] = [];
      for (const item of detail.items) {
        if (item.status !== 'completed' || !item.usage) continue;
        entries.push({
          runId: detail.id,
          runTitle: detail.title,
          itemId: item.id,
          inputName: item.inputName,
          actorUid: createdByUid === 'admin' ? adminUid : detail.createdByUid,
          actorEmail: detail.createdByEmail,
          modality: detail.modality,
          executionMode: detail.executionMode,
          providerId: detail.providerId,
          model: detail.model,
          promptSource: detail.promptSource,
          promptParams: detail.promptParams,
          promptMetadata: detail.promptMetadata,
          outputFormat: item.outputFormat,
          latencyMs: item.latencyMs ?? 0,
          usage: item.usage,
          completedAtMs:
            item.completedAtMs ?? detail.completedAtMs ?? detail.updatedAtMs,
        });
      }

      if (entries.length > 0) {
        await this.recordCompletedItems(entries);
      } else {
        this.syncedRunsSessionCache.add(runId);
        await db
          .collection(RUNS_COLLECTION)
          .doc(runId)
          .set({ telemetrySynced: true }, { merge: true })
          .catch(() => undefined);
      }
    }
  }

  async listLogsForAdmin(
    adminUid: string,
    limit = 100
  ): Promise<AdminTelemetryLogRecord[]> {
    await this.backfillUnsyncedPromptEvalRuns(adminUid);
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    const snapshot = await this.getDb()
      .collection(GENERATION_LOGS_COLLECTION)
      .where('adminUid', '==', adminUid)
      .limit(200)
      .get();

    const items = snapshot.docs.map((doc) =>
      this.normalizeDocToRecord(doc.id, doc.data())
    );
    items.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
    return items.slice(0, safeLimit);
  }

  async deleteLogForAdmin(logId: string, adminUid: string): Promise<boolean> {
    if (!SAFE_DOC_ID_PATTERN.test(logId)) return false;
    const docRef = this.getDb()
      .collection(GENERATION_LOGS_COLLECTION)
      .doc(logId);
    const snap = await docRef.get();
    if (!snap.exists) return false;
    const data = snap.data() ?? {};
    if (data.adminUid !== adminUid && data.adminUid !== 'admin') {
      return false;
    }
    await docRef.delete();
    return true;
  }
}
