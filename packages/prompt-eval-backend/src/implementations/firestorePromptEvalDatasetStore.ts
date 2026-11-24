import fs from 'node:fs';
import path from 'node:path';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type {
  PromptEvalDatasetDetail,
  PromptEvalDatasetItemSummary,
  PromptEvalDatasetSummary,
} from '../../../prompt-eval-core/src/index.ts';
import type {
  PromptEvalDatasetStore,
  PromptEvalStoredDatasetItem,
} from '../promptEval.interface.ts';

const DATASETS_COLLECTION = 'prompt_eval_datasets';
const ITEMS_SUBCOLLECTION = 'items';
const MAX_FIRESTORE_BATCH_OPS = 450;

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

function normalizeDatasetSummary(
  docId: string,
  raw: FirebaseFirestore.DocumentData
): PromptEvalDatasetSummary {
  return {
    id: String(raw.id ?? docId),
    slug: String(raw.slug ?? docId),
    name: String(raw.name ?? docId),
    description:
      typeof raw.description === 'string' && raw.description.length > 0
        ? raw.description
        : undefined,
    source: 'app',
    readOnly: false,
    itemCount: Number(raw.itemCount ?? 0),
    previewThumbnails: Array.isArray(raw.previewThumbnails)
      ? raw.previewThumbnails
          .filter((entry: unknown) => typeof entry === 'string')
          .slice(0, 4)
      : [],
    createdAtMs: Number(raw.createdAtMs ?? 0),
    updatedAtMs: Number(raw.updatedAtMs ?? 0),
    createdByEmail:
      typeof raw.createdByEmail === 'string' ? raw.createdByEmail : undefined,
  };
}

function normalizeDatasetItemSummary(
  docId: string,
  raw: FirebaseFirestore.DocumentData
): PromptEvalDatasetItemSummary {
  return {
    id: String(raw.id ?? docId),
    index: Number(raw.index ?? 0),
    name: String(raw.name ?? ''),
    mimeType: String(raw.mimeType ?? 'image/jpeg'),
    sizeBytes: Number(raw.sizeBytes ?? 0),
    width: typeof raw.width === 'number' ? raw.width : undefined,
    height: typeof raw.height === 'number' ? raw.height : undefined,
    thumbnailDataUrl:
      typeof raw.thumbnailDataUrl === 'string'
        ? raw.thumbnailDataUrl
        : undefined,
  };
}

function parseDataUrlToBytes(
  dataUrl: string,
  fallbackMimeType: string
): { mimeType: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = match[1].toLowerCase() || fallbackMimeType;
  const buf = Buffer.from(match[2], 'base64');
  return {
    mimeType,
    bytes: new Uint8Array(buf),
  };
}

export interface FirestorePromptEvalDatasetStoreOptions {
  db?: Firestore;
  firebaseConfigPath?: string;
  projectId?: string;
  databaseId?: string;
  collectionName?: string;
}

export class FirestorePromptEvalDatasetStore implements PromptEvalDatasetStore {
  private readonly firebaseConfigPath?: string;
  private readonly explicitProjectId?: string;
  private readonly explicitDatabaseId?: string;
  private readonly collectionName: string;
  private cachedDb: Firestore | null = null;

  constructor(options: FirestorePromptEvalDatasetStoreOptions = {}) {
    this.cachedDb = options.db ?? null;
    this.firebaseConfigPath = options.firebaseConfigPath;
    this.explicitProjectId = options.projectId;
    this.explicitDatabaseId = options.databaseId;
    this.collectionName = options.collectionName ?? DATASETS_COLLECTION;
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

  async createDataset(
    dataset: PromptEvalDatasetDetail,
    itemsWithBytes: PromptEvalStoredDatasetItem[]
  ): Promise<PromptEvalDatasetDetail> {
    const db = this.getDb();
    const { items: _items, ...summary } = dataset;
    const docRef = db.collection(this.collectionName).doc(dataset.id);

    const encodedItems = itemsWithBytes.map((item) => {
      const imageDataUrl = `data:${item.mimeType};base64,${Buffer.from(
        item.bytes
      ).toString('base64')}`;
      return {
        id: item.id,
        index: item.index,
        name: item.name,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        width: item.width,
        height: item.height,
        thumbnailDataUrl: item.thumbnailDataUrl,
        imageDataUrl,
      };
    });

    const firstChunkSize = MAX_FIRESTORE_BATCH_OPS - 1;
    const firstBatch = db.batch();
    firstBatch.set(docRef, stripUndefined(summary));
    for (const item of encodedItems.slice(0, firstChunkSize)) {
      const itemRef = docRef.collection(ITEMS_SUBCOLLECTION).doc(item.id);
      firstBatch.set(itemRef, stripUndefined(item));
    }
    await firstBatch.commit();

    for (
      let offset = firstChunkSize;
      offset < encodedItems.length;
      offset += MAX_FIRESTORE_BATCH_OPS
    ) {
      const chunkBatch = db.batch();
      for (const item of encodedItems.slice(
        offset,
        offset + MAX_FIRESTORE_BATCH_OPS
      )) {
        const itemRef = docRef.collection(ITEMS_SUBCOLLECTION).doc(item.id);
        chunkBatch.set(itemRef, stripUndefined(item));
      }
      await chunkBatch.commit();
    }

    return dataset;
  }

  async listDatasets(limit = 100): Promise<PromptEvalDatasetSummary[]> {
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    const snapshot = await this.getDb()
      .collection(this.collectionName)
      .orderBy('createdAtMs', 'desc')
      .limit(safeLimit)
      .get();

    return snapshot.docs.map((doc) =>
      normalizeDatasetSummary(doc.id, doc.data())
    );
  }

  async getDataset(datasetId: string): Promise<PromptEvalDatasetDetail | null> {
    const docRef = this.getDb().collection(this.collectionName).doc(datasetId);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const summary = normalizeDatasetSummary(snap.id, snap.data() ?? {});
    const itemsSnap = await docRef
      .collection(ITEMS_SUBCOLLECTION)
      .orderBy('index', 'asc')
      .get();

    const items = itemsSnap.docs.map((doc) =>
      normalizeDatasetItemSummary(doc.id, doc.data())
    );

    return {
      ...summary,
      itemCount: items.length,
      items,
    };
  }

  async loadDatasetItemBytes(
    datasetId: string,
    itemId: string
  ): Promise<PromptEvalStoredDatasetItem | null> {
    const itemSnap = await this.getDb()
      .collection(this.collectionName)
      .doc(datasetId)
      .collection(ITEMS_SUBCOLLECTION)
      .doc(itemId)
      .get();

    if (!itemSnap.exists) return null;
    const raw = itemSnap.data() ?? {};
    const summary = normalizeDatasetItemSummary(itemSnap.id, raw);
    const dataUrl = typeof raw.imageDataUrl === 'string' ? raw.imageDataUrl : '';
    const decoded = parseDataUrlToBytes(dataUrl, summary.mimeType);
    if (!decoded) return null;

    return {
      ...summary,
      mimeType: decoded.mimeType,
      sizeBytes: decoded.bytes.byteLength,
      bytes: decoded.bytes,
    };
  }

  async deleteDataset(datasetId: string): Promise<boolean> {
    const db = this.getDb();
    const docRef = db.collection(this.collectionName).doc(datasetId);
    const snap = await docRef.get();
    if (!snap.exists) return false;

    const itemsSnap = await docRef.collection(ITEMS_SUBCOLLECTION).get();
    const refs = [...itemsSnap.docs.map((d) => d.ref), docRef];

    for (let offset = 0; offset < refs.length; offset += MAX_FIRESTORE_BATCH_OPS) {
      const batch = db.batch();
      for (const ref of refs.slice(offset, offset + MAX_FIRESTORE_BATCH_OPS)) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    return true;
  }
}
