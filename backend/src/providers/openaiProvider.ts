import type { ServerConfig } from '../config/env.ts';
import { buildRasterColoringPrompt } from '../utils/prompts.ts';
import {
  ProviderConfigurationError,
  ProviderExecutionError,
  type ColoringGenerationInput,
  type ColoringGenerationOutput,
  type ColoringProvider,
  type ProviderStatus,
} from './types.ts';

export class OpenAIColoringProvider implements ColoringProvider {
  readonly id = 'openai' as const;
  readonly label = 'OpenAI';
  private readonly config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.openaiApiKey.length > 0;
  }

  getStatus(isDefault: boolean): ProviderStatus {
    return {
      id: this.id,
      label: this.label,
      model: this.config.openaiModel,
      configured: this.isConfigured(),
      isDefault,
      tierLabel: 'Modello immagine (predisposto)',
    };
  }

  async generateColoringPage(
    input: ColoringGenerationInput
  ): Promise<ColoringGenerationOutput> {
    if (!this.isConfigured()) {
      throw new ProviderConfigurationError(
        'OPENAI_API_KEY non è configurata sul server. Aggiungi la chiave nelle variabili d’ambiente per utilizzare OpenAI.',
        503
      );
    }

    const { prompt, version: promptVersion } = buildRasterColoringPrompt(
      input.themeId
    );
    const formData = new FormData();
    const ext = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const imageBytes = new Uint8Array(input.imageBuffer);
    const imageBlob = new Blob([imageBytes], { type: input.mimeType });
    formData.append('image', imageBlob, `photo.${ext}`);
    formData.append('model', this.config.openaiModel);
    formData.append('prompt', prompt);
    formData.append('size', '1024x1536');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        throw new ProviderConfigurationError(
          'Chiave OpenAI non valida o non autorizzata.',
          403
        );
      }
      if (response.status === 429) {
        throw new ProviderExecutionError(
          'Limite di richieste OpenAI raggiunto. Riprova tra qualche secondo.',
          429
        );
      }
      throw new ProviderExecutionError(
        `Errore OpenAI (${response.status}): ${errBody.slice(0, 140) || 'richiesta non riuscita'}.`,
        502
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    const first = payload.data?.[0];
    if (first?.b64_json) {
      return {
        provider: this.id,
        model: this.config.openaiModel,
        promptVersion,
        outputFormat: 'raster',
        imageDataUrl: `data:image/png;base64,${first.b64_json}`,
        sceneSummary: 'Pagina da colorare generata con OpenAI a partire dalla tua foto.',
      };
    }
    if (first?.url) {
      return {
        provider: this.id,
        model: this.config.openaiModel,
        promptVersion,
        outputFormat: 'raster',
        imageDataUrl: first.url,
        sceneSummary: 'Pagina da colorare generata con OpenAI a partire dalla tua foto.',
      };
    }

    throw new ProviderExecutionError(
      'OpenAI non ha restituito alcuna immagine valida.'
    );
  }
}
