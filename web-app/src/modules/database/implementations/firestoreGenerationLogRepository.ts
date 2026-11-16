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
} from 'firebase/firestore';
import type { ThemeId } from '../../../../../shared/types/index.ts';
import {
  OperationType,
  type AdminProfileInput,
  type FirestoreErrorInfo,
  type GenerationLogRecord,
  type GenerationLogRepository,
  type SaveGenerationLogInput,
  type UnsubscribeFn,
} from '../database.interface';
import { auth, db } from './firebaseAppInstance';

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

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Number(value.toFixed(6))));
}

export class FirestoreGenerationLogRepository
  implements GenerationLogRepository
{
  async ensureAdminProfile(profile: AdminProfileInput): Promise<void> {
    try {
      const ref = doc(db, 'admins', profile.uid);
      await getDoc(ref);
    } catch {
      // Admin privilege is verified via Firebase Auth custom claim `{ admin: true }`
    }
  }

  async saveLog(input: SaveGenerationLogInput): Promise<string> {
    const path = 'generation_logs';
    const safePromptVersion = /^v[0-9]+$/.test(input.telemetry.promptVersion)
      ? input.telemetry.promptVersion.slice(0, 20)
      : 'v1';

    const payload = {
      adminUid: input.adminUid.slice(0, 128),
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
      textOutputTokens: clampInt(input.telemetry.textOutputTokens, 0, 1_000_000),
      imageOutputTokens: clampInt(
        input.telemetry.imageOutputTokens,
        0,
        1_000_000
      ),
      estimatedCostUsd: clampFloat(input.telemetry.estimatedCostUsd, 0, 100),
      latencyMs: clampInt(input.telemetry.latencyMs, 0, 600_000),
      createdAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, path), payload);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  subscribeLogs(
    adminUid: string,
    onLogs: (logs: GenerationLogRecord[]) => void,
    onError: (err: Error) => void
  ): UnsubscribeFn {
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

  async deleteLog(logId: string): Promise<void> {
    const path = `generation_logs/${logId}`;
    try {
      await deleteDoc(doc(db, 'generation_logs', logId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}
