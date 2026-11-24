import type {
  AdminTelemetry,
  AdminTelemetryLogRecord,
  GenerationLogThemeId,
} from '../../../../shared/types/index.ts';

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

export type GenerationLogRecord = AdminTelemetryLogRecord;

export interface SaveGenerationLogInput {
  adminUid: string;
  themeId: GenerationLogThemeId;
  telemetry: AdminTelemetry;
}

export interface AdminProfileInput {
  uid: string;
  email: string;
}

export type UnsubscribeFn = () => void;

export interface GenerationLogRepository {
  ensureAdminProfile(profile: AdminProfileInput): Promise<void>;
  saveLog(input: SaveGenerationLogInput): Promise<string>;
  subscribeLogs(
    adminUid: string,
    onLogs: (logs: GenerationLogRecord[]) => void,
    onError: (err: Error) => void
  ): UnsubscribeFn;
  deleteLog(logId: string): Promise<void>;
}
