import {
  ALLOWED_THEME_IDS,
  type ColoringOutputFormat,
  type ProviderStatus,
  type ThemeId,
} from '../../../../shared/types/index.ts';
import type { SupportedProviderId } from '../config/config.interface.ts';
import type { UsageBreakdown } from '../cost-estimation/costEstimation.interface.ts';

export {
  ALLOWED_THEME_IDS,
  type ColoringOutputFormat,
  type ProviderStatus,
  type ThemeId,
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
