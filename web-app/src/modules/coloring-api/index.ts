import type {
  AdminSessionResponse,
  ColoringApiClient,
  ColoringGenerationResponse,
  GenerateColoringPageRequest,
} from './coloringApi.interface';
import { FetchColoringApiClient } from './implementations/fetchColoringApiClient';

export {
  ColoringApiError,
  type AdminDebugInfo,
  type AdminErrorDetails,
  type AdminSessionResponse,
  type AdminTelemetry,
  type ColoringApiClient,
  type ColoringGenerationResponse,
  type GenerateColoringPageRequest,
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
