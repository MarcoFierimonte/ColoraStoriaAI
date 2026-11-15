import type { SupportedProviderId } from '../config/env.ts';

export const ALLOWED_THEME_IDS = [
  'pirati',
  'unicorni',
  'draghi',
  'spazio',
  'dinosauri',
  'principessa',
] as const;

export type ThemeId = (typeof ALLOWED_THEME_IDS)[number];

export interface ColoringGenerationInput {
  imageBuffer: Buffer;
  mimeType: string;
  themeId: ThemeId;
}

export interface ColoringGenerationOutput {
  provider: SupportedProviderId;
  model: string;
  promptVersion: string;
  outputFormat: 'svg' | 'raster';
  imageDataUrl: string;
  svgMarkup?: string;
  sceneSummary: string;
}

export interface ProviderStatus {
  id: SupportedProviderId;
  label: string;
  model: string;
  configured: boolean;
  isDefault: boolean;
  tierLabel: string;
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

export class ProviderConfigurationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'ProviderConfigurationError';
    this.statusCode = statusCode;
  }
}

export class ProviderExecutionError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'ProviderExecutionError';
    this.statusCode = statusCode;
  }
}
