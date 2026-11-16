import type {
  AdminErrorDetails,
  AdminSessionResponse,
  AdminTelemetry,
  ColoringGenerationResponse,
  ProviderId,
  ProviderStatus,
  ThemeId,
} from '../../../../shared/types/index.ts';

export type {
  AdminErrorDetails,
  AdminSessionResponse,
  AdminTelemetry,
  ColoringGenerationResponse,
  ProviderId,
  ProviderStatus,
  ThemeId,
};

export interface AdminDebugInfo {
  statusCode?: number;
  statusText?: string;
  contentType?: string | null;
  isProxyCookieCheck?: boolean;
  rawBodySnippet?: string;
  backendDetails?: AdminErrorDetails;
}

export class ColoringApiError extends Error {
  readonly adminDebugInfo?: AdminDebugInfo;

  constructor(message: string, adminDebugInfo?: AdminDebugInfo) {
    super(message);
    this.name = 'ColoringApiError';
    this.adminDebugInfo = adminDebugInfo;
  }
}

export interface GenerateColoringPageRequest {
  file: File;
  themeId: ThemeId;
  providerId?: ProviderId;
  promptVersion?: string;
  idToken?: string | null;
}

export interface ColoringApiClient {
  fetchProviders(): Promise<ProviderStatus[]>;
  fetchAdminSession(idToken?: string | null): Promise<AdminSessionResponse>;
  generateColoringPage(
    params: GenerateColoringPageRequest
  ): Promise<ColoringGenerationResponse>;
}
