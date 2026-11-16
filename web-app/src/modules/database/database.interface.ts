import type {
  AdminTelemetry,
  ColoringOutputFormat,
  ProviderId,
  ThemeId,
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

export interface GenerationLogRecord {
  id: string;
  adminUid: string;
  provider: ProviderId;
  model: string;
  promptVersion: string;
  themeId: ThemeId;
  outputFormat: ColoringOutputFormat;
  inputTokens: number;
  cachedInputTokens: number;
  textOutputTokens: number;
  imageOutputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  createdAtMs: number | null;
}

export interface SaveGenerationLogInput {
  adminUid: string;
  themeId: ThemeId;
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
