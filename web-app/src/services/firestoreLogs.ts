import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ThemeId } from '../data/themes';
import { auth, db } from '../firebase';
import type { AdminTelemetry, ProviderId } from './coloringApi';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface GenerationLogRecord {
  id: string;
  adminUid: string;
  provider: ProviderId;
  model: string;
  promptVersion: string;
  themeId: ThemeId;
  outputFormat: 'svg' | 'raster';
  inputTokens: number;
  cachedInputTokens: number;
  textOutputTokens: number;
  imageOutputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  createdAtMs: number | null;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Number(value.toFixed(6))));
}

export async function ensureAdminDoc(
  uid: string,
  email: string
): Promise<void> {
  const adminPath = `admins/${uid}`;
  try {
    const ref = doc(db, 'admins', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: uid.slice(0, 128),
        email: email.slice(0, 254),
        role: 'admin',
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, adminPath);
  }
}

export async function saveGenerationLog(params: {
  adminUid: string;
  themeId: ThemeId;
  telemetry: AdminTelemetry;
}): Promise<string> {
  const path = 'generation_logs';
  const safePromptVersion = /^v[0-9]+$/.test(params.telemetry.promptVersion)
    ? params.telemetry.promptVersion.slice(0, 20)
    : 'v1';

  const payload = {
    adminUid: params.adminUid.slice(0, 128),
    provider: params.telemetry.provider,
    model: params.telemetry.model.slice(0, 80) || 'unknown',
    promptVersion: safePromptVersion,
    themeId: params.themeId,
    outputFormat: params.telemetry.outputFormat,
    inputTokens: clampInt(params.telemetry.inputTokens, 0, 1_000_000),
    cachedInputTokens: clampInt(params.telemetry.cachedInputTokens, 0, 1_000_000),
    textOutputTokens: clampInt(params.telemetry.textOutputTokens, 0, 1_000_000),
    imageOutputTokens: clampInt(params.telemetry.imageOutputTokens, 0, 1_000_000),
    estimatedCostUsd: clampFloat(params.telemetry.estimatedCostUsd, 0, 100),
    latencyMs: clampInt(params.telemetry.latencyMs, 0, 600_000),
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, path), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeGenerationLogs(
  adminUid: string,
  onLogs: (logs: GenerationLogRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'generation_logs';
  const q = query(
    collection(db, path),
    where('adminUid', '==', adminUid),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: GenerationLogRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt;
        const createdAtMs =
          createdAt instanceof Timestamp ? createdAt.toMillis() : null;

        return {
          id: docSnap.id,
          adminUid: String(data.adminUid ?? ''),
          provider: data.provider === 'openai' ? 'openai' : 'gemini',
          model: String(data.model ?? ''),
          promptVersion: String(data.promptVersion ?? 'v1'),
          themeId: (data.themeId as ThemeId) ?? 'pirati',
          outputFormat: data.outputFormat === 'raster' ? 'raster' : 'svg',
          inputTokens: Number(data.inputTokens ?? 0),
          cachedInputTokens: Number(data.cachedInputTokens ?? 0),
          textOutputTokens: Number(data.textOutputTokens ?? 0),
          imageOutputTokens: Number(data.imageOutputTokens ?? 0),
          estimatedCostUsd: Number(data.estimatedCostUsd ?? 0),
          latencyMs: Number(data.latencyMs ?? 0),
          createdAtMs,
        };
      });

      items.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
      onLogs(items.slice(0, 25));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(
          wrapped instanceof Error ? wrapped : new Error(String(wrapped))
        );
      }
    }
  );
}

export async function deleteGenerationLog(logId: string): Promise<void> {
  const path = `generation_logs/${logId}`;
  try {
    await deleteDoc(doc(db, 'generation_logs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
