import type {
  AdminSessionResponse,
  ColoringApiClient,
  ColoringGenerationResponse,
  ExportPrintPdfRequest,
  GenerateColoringPageRequest,
} from './coloringApi.interface';
import { FetchColoringApiClient } from './implementations/fetchColoringApiClient';

export {
  ColoringApiError,
  type AdminDebugInfo,
  type AdminErrorDetails,
  type AdminSessionResponse,
  type AdminTelemetry,
  type ColoringAgeGroup,
  type ColoringApiClient,
  type ColoringGenerationResponse,
  type ColoringStyleMode,
  type ExportPrintPdfRequest,
  type GenerateColoringPageRequest,
  type PrintPdfLayout,
  type ProviderId,
  type ProviderStatus,
} from './coloringApi.interface';
export { FetchColoringApiClient } from './implementations/fetchColoringApiClient';

export const coloringApiClient: ColoringApiClient =
  new FetchColoringApiClient('/api');

export function fetchAdminSession(
  idToken?: string | null
): Promise<AdminSessionResponse> {
  return coloringApiClient.fetchAdminSession(idToken);
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
