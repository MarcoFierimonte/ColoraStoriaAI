export const ALLOWED_THEME_IDS = [
  'pirati',
  'unicorni',
  'draghi',
  'spazio',
  'dinosauri',
  'principessa',
] as const;

export type ThemeId = (typeof ALLOWED_THEME_IDS)[number];

export function isAllowedThemeId(value: string): value is ThemeId {
  return (ALLOWED_THEME_IDS as readonly string[]).includes(value);
}

export const SUPPORTED_PROVIDER_IDS = ['gemini', 'openai'] as const;

export type ProviderId = (typeof SUPPORTED_PROVIDER_IDS)[number];

export type ColoringOutputFormat = 'svg' | 'raster';

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  model: string;
  configured: boolean;
  isDefault: boolean;
  tierLabel: string;
}

export interface UsageBreakdown {
  inputTokens: number;
  cachedInputTokens: number;
  textOutputTokens: number;
  imageOutputTokens: number;
  estimatedCostUsd: number;
  projectedBook16CostUsd: number;
  isFreeTier: boolean;
}

export interface AdminTelemetry extends UsageBreakdown {
  provider: ProviderId;
  model: string;
  promptVersion: string;
  outputFormat: ColoringOutputFormat;
  latencyMs: number;
}

export interface AdminErrorDetails {
  statusCode?: number;
  errorName?: string;
  provider?: string;
  rawMessage?: string;
  timestamp?: string;
}

export interface AdminSessionResponse {
  authenticated: boolean;
  isAdmin: boolean;
  email: string | null;
  uid: string | null;
  promptVersions: string[];
  activePromptVersion: string | null;
  providers: ProviderStatus[];
}

export interface ColoringGenerationResponse {
  ok: true;
  provider: ProviderId;
  model: string;
  outputFormat: ColoringOutputFormat;
  imageDataUrl: string;
  svgMarkup?: string;
  sceneSummary: string;
  adminTelemetry?: AdminTelemetry;
}

export interface ColoringErrorResponse {
  error: string;
  adminErrorDetails?: AdminErrorDetails;
}

export interface HealthResponse {
  ok: true;
}
