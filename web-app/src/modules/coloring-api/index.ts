import type {
  AdminSessionResponse,
  AdminTelemetryLogRecord,
  ColoringApiClient,
  ColoringGenerationResponse,
  ExportPrintPdfRequest,
  GenerateColoringPageRequest,
} from './coloringApi.interface.ts';
import { FetchColoringApiClient } from './implementations/fetchColoringApiClient.ts';

export {
  ColoringApiError,
  type AdminDebugInfo,
  type AdminErrorDetails,
  type AdminSessionResponse,
  type AdminTelemetry,
  type AdminTelemetryLogRecord,
  type ColoringAgeGroup,
  type ColoringApiClient,
  type ColoringGenerationResponse,
  type ColoringStyleMode,
  type ExportPrintPdfRequest,
  type GenerateColoringPageRequest,
  type PrintPdfLayout,
  type ProviderId,
  type ProviderStatus,
} from './coloringApi.interface.ts';
export { FetchColoringApiClient } from './implementations/fetchColoringApiClient.ts';

export const coloringApiClient: ColoringApiClient =
  new FetchColoringApiClient('/api');

export function fetchAdminSession(
  idToken?: string | null
): Promise<AdminSessionResponse> {
  return coloringApiClient.fetchAdminSession(idToken);
}

export function fetchAdminTelemetryLogsApi(
  idToken?: string | null,
  limit = 100
): Promise<AdminTelemetryLogRecord[]> {
  return coloringApiClient.fetchAdminTelemetryLogs(idToken, limit);
}

export function deleteAdminTelemetryLogApi(
  logId: string,
  idToken?: string | null
): Promise<void> {
  return coloringApiClient.deleteAdminTelemetryLog(logId, idToken);
}

export function generateColoringPageApi(
  params: GenerateColoringPageRequest
): Promise<ColoringGenerationResponse> {
  return coloringApiClient.generateColoringPage(params);
}

export function exportPrintPdfApi(
  params: ExportPrintPdfRequest,
  idToken?: string | null
): Promise<Blob> {
  return coloringApiClient.exportPrintPdf(params, idToken);
}
