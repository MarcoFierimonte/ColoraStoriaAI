import type {
  AdminErrorDetails,
  AdminSessionResponse,
  AdminTelemetry,
  ColoringAgeGroup,
  ColoringGenerationResponse,
  ColoringStyleMode,
  ExportPrintPdfRequest,
  PrintPdfLayout,
  ProviderId,
  ProviderStatus,
  ThemeId,
} from '../../../../shared/types/index.ts';

export type {
  AdminErrorDetails,
  AdminSessionResponse,
  AdminTelemetry,
  ColoringAgeGroup,
  ColoringGenerationResponse,
  ColoringStyleMode,
  ExportPrintPdfRequest,
  PrintPdfLayout,
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
  mode?: ColoringStyleMode;
  ageGroup?: ColoringAgeGroup;
  providerId?: ProviderId;
  promptVersion?: string;
  idToken?: string | null;
  turnstileToken?: string | null;
  appCheckToken?: string | null;
}

export interface ColoringApiClient {
  fetchAdminSession(idToken?: string | null): Promise<AdminSessionResponse>;
  generateColoringPage(
    params: GenerateColoringPageRequest
  ): Promise<ColoringGenerationResponse>;
  exportPrintPdf(
    params: ExportPrintPdfRequest,
    idToken?: string | null
  ): Promise<Blob>;
}
