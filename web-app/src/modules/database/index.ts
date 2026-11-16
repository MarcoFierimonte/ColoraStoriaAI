import type {
  AdminProfileInput,
  GenerationLogRecord,
  GenerationLogRepository,
  SaveGenerationLogInput,
  UnsubscribeFn,
} from './database.interface';
import { FirestoreGenerationLogRepository } from './implementations/firestoreGenerationLogRepository';

export {
  OperationType,
  type AdminProfileInput,
  type FirestoreErrorInfo,
  type GenerationLogRecord,
  type GenerationLogRepository,
  type SaveGenerationLogInput,
  type UnsubscribeFn,
} from './database.interface';
export {
  auth,
  db,
  googleProvider,
  testFirestoreConnection,
} from './implementations/firebaseAppInstance';
export {
  FirestoreGenerationLogRepository,
  handleFirestoreError,
} from './implementations/firestoreGenerationLogRepository';

export const generationLogRepository: GenerationLogRepository =
  new FirestoreGenerationLogRepository();

export function ensureAdminDoc(uid: string, email: string): Promise<void> {
  return generationLogRepository.ensureAdminProfile({ uid, email });
}

export function saveGenerationLog(
  params: SaveGenerationLogInput
): Promise<string> {
  return generationLogRepository.saveLog(params);
}

export function subscribeGenerationLogs(
  adminUid: string,
  onLogs: (logs: GenerationLogRecord[]) => void,
  onError: (err: Error) => void
): UnsubscribeFn {
  return generationLogRepository.subscribeLogs(adminUid, onLogs, onError);
}

export function deleteGenerationLog(logId: string): Promise<void> {
  return generationLogRepository.deleteLog(logId);
}
