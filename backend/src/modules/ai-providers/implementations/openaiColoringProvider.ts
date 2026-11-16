import type { ServerConfig } from '../../config/config.interface.ts';
import type { CostEstimator } from '../../cost-estimation/costEstimation.interface.ts';
import type { PromptRepository } from '../../prompts/promptRepository.interface.ts';
import {
  ProviderConfigurationError,
  ProviderExecutionError,
  type ColoringGenerationInput,
  type ColoringGenerationOutput,
  type ColoringProvider,
  type ProviderStatus,
} from '../aiProvider.interface.ts';

export class OpenAIColoringProvider implements ColoringProvider {
  readonly id = 'openai' as const;
  readonly label = 'OpenAI';
  private readonly config: ServerConfig;
  private readonly promptRepository: PromptRepository;
  private readonly costEstimator: CostEstimator;

  constructor(params: {
    config: ServerConfig;
    promptRepository: PromptRepository;
    costEstimator: CostEstimator;
  }) {
    this.config = params.config;
    this.promptRepository = params.promptRepository;
    this.costEstimator = params.costEstimator;
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
        'Servizio di generazione temporaneamente non disponibile.',
        503,
        'Missing process.env.OPENAI_API_KEY'
      );
    }

    const { prompt, version: promptVersion } =
      this.promptRepository.buildRasterPrompt(
        input.themeId,
        input.promptVersionOverride
      );
    const formData = new FormData();
    const ext =
      input.mimeType === 'image/png'
        ? 'png'
        : input.mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const imageBytes = new Uint8Array(input.imageBuffer);
    const imageBlob = new Blob([imageBytes], { type: input.mimeType });
    formData.append('image', imageBlob, `photo.${ext}`);
    formData.append('model', this.config.openaiModel);
    formData.append('prompt', prompt);
    formData.append('size', '1024x1536');

    const startedAt = Date.now();
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      body: formData,
    });
    const latencyMs = Math.max(0, Date.now() - startedAt);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      const rawDetails = `OpenAI HTTP ${response.status} ${response.statusText}: ${errBody.slice(0, 600)}`;
      if (response.status === 401 || response.status === 403) {
        throw new ProviderConfigurationError(
          'Servizio di generazione temporaneamente non disponibile.',
          503,
          rawDetails
        );
      }
      if (response.status === 429) {
        throw new ProviderExecutionError(
          'Limite momentaneo di richieste raggiunto. Attendi qualche secondo e riprova.',
          429,
          rawDetails
        );
      }
      throw new ProviderExecutionError(
        'Errore durante la generazione del disegno. Riprova tra qualche istante.',
        502,
        rawDetails
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
        output_tokens_details?: { image_tokens?: number; text_tokens?: number };
      };
    };

    const inputTokens = payload.usage?.input_tokens ?? 0;
    const cachedInputTokens = payload.usage?.input_tokens_details?.cached_tokens ?? 0;
    const imageOutputTokens =
      payload.usage?.output_tokens_details?.image_tokens ??
      payload.usage?.output_tokens ??
      0;
    const textOutputTokens =
      payload.usage?.output_tokens_details?.text_tokens ??
      Math.max(0, (payload.usage?.output_tokens ?? 0) - imageOutputTokens);

    const usage = this.costEstimator.calculate({
      model: this.config.openaiModel,
      inputTokens,
      cachedInputTokens,
      textOutputTokens,
      imageOutputTokens,
    });

    const first = payload.data?.[0];
    if (first?.b64_json) {
      return {
        provider: this.id,
        model: this.config.openaiModel,
        promptVersion,
        outputFormat: 'raster',
        imageDataUrl: `data:image/png;base64,${first.b64_json}`,
        sceneSummary: 'Pagina da colorare generata con OpenAI a partire dalla tua foto.',
        latencyMs,
        usage,
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
        latencyMs,
        usage,
      };
    }

    throw new ProviderExecutionError(
      'OpenAI non ha restituito alcuna immagine valida.'
    );
  }
}
