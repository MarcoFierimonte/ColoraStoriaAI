import {
  ALLOWED_THEME_IDS,
  type ColoringOutputFormat,
  type ProviderId,
  type ProviderStatus,
  type ThemeId,
  type UsageBreakdown,
} from '../../../../shared/types/index.ts';

export type SupportedProviderId = ProviderId;

export {
  ALLOWED_THEME_IDS,
  type ColoringOutputFormat,
  type ProviderId,
  type ProviderStatus,
  type ThemeId,
  type UsageBreakdown,
};

export interface ColoringGenerationInput {
  imageBuffer: Buffer;
  mimeType: string;
  themeId: ThemeId;
  promptVersionOverride?: string;
}

export interface ColoringGenerationOutput {
  provider: SupportedProviderId;
  model: string;
  promptVersion: string;
  outputFormat: ColoringOutputFormat;
  imageDataUrl: string;
  svgMarkup?: string;
  sceneSummary: string;
  latencyMs: number;
  usage: UsageBreakdown;
}

export interface ColoringProvider {
  readonly id: SupportedProviderId;
  readonly label: string;
  isConfigured(): boolean;
  getStatus(isDefault: boolean): ProviderStatus;
  generateColoringPage(
    input: ColoringGenerationInput
  ): Promise<ColoringGenerationOutput>;
}

export interface AiProviderRegistry {
  getProvider(requestedId?: string): ColoringProvider;
  listStatuses(): ProviderStatus[];
}

export class ProviderConfigurationError extends Error {
  readonly statusCode: number;
  readonly rawDetails?: string;

  constructor(message: string, statusCode = 503, rawDetails?: string) {
    super(message);
    this.name = 'ProviderConfigurationError';
    this.statusCode = statusCode;
    this.rawDetails = rawDetails;
  }
}

export class ProviderExecutionError extends Error {
  readonly statusCode: number;
  readonly rawDetails?: string;

  constructor(message: string, statusCode = 502, rawDetails?: string) {
    super(message);
    this.name = 'ProviderExecutionError';
    this.statusCode = statusCode;
    this.rawDetails = rawDetails;
  }
}
