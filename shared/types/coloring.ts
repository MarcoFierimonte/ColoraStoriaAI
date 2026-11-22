import {
  ALLOWED_AGE_GROUPS,
  ALLOWED_COLORING_MODES,
  ALLOWED_THEME_IDS,
  DEFAULT_AGE_GROUP,
  DEFAULT_COLORING_MODE,
  PRINT_PDF_LAYOUTS,
  SUPPORTED_PROVIDER_IDS,
  isAllowedThemeId,
  isColoringAgeGroup,
  isColoringStyleMode,
  isPrintPdfLayout,
  type ColoringAgeGroup,
  type ColoringStyleMode,
  type PrintPdfLayout,
  type ProviderId,
  type ThemeId,
} from '../config/limits.ts';
import type { BetaInviteQuota } from './access.ts';

export {
  ALLOWED_AGE_GROUPS,
  ALLOWED_COLORING_MODES,
  ALLOWED_THEME_IDS,
  DEFAULT_AGE_GROUP,
  DEFAULT_COLORING_MODE,
  PRINT_PDF_LAYOUTS,
  SUPPORTED_PROVIDER_IDS,
  isAllowedThemeId,
  isColoringAgeGroup,
  isColoringStyleMode,
  isPrintPdfLayout,
  type ColoringAgeGroup,
  type ColoringStyleMode,
  type PrintPdfLayout,
  type ProviderId,
  type ThemeId,
};

export type ColoringOutputFormat = 'svg' | 'raster';

export type GenerationLogThemeId = ThemeId | 'fedele';

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
  hasAdminClaim?: boolean;
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
  inviteQuota?: BetaInviteQuota;
}

export interface ColoringErrorResponse {
  error: string;
  adminErrorDetails?: AdminErrorDetails;
}

export interface ExportPrintPdfRequest {
  imageDataUrl: string;
  layout: PrintPdfLayout;
}

export interface HealthResponse {
  ok: true;
}
