import { GoogleGenAI, Type } from '@google/genai';
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

const IMAGE_OUTPUT_MODELS = new Set([
  'gemini-3.1-flash-lite-image',
  'gemini-nano-banana-2.1',
  'gemini-3-pro-image',
]);

function sanitizeSvgMarkup(rawSvg: string): string {
  let svg = rawSvg.trim();
  const svgStart = svg.indexOf('<svg');
  const svgEnd = svg.lastIndexOf('</svg>');
  if (svgStart === -1 || svgEnd === -1) {
    throw new ProviderExecutionError(
      'Il modello non ha restituito un disegno SVG valido. Riprova tra un istante.',
      502,
      `Missing <svg>...</svg> tags in svgMarkup (length=${rawSvg.length}): ${rawSvg.slice(0, 400)}`
    );
  }
  svg = svg.slice(svgStart, svgEnd + 6);
  svg = svg.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  svg = svg.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');
  if (!svg.includes('xmlns=')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

function extractErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    if (
      'status' in error &&
      typeof (error as { status?: unknown }).status === 'number'
    ) {
      return (error as { status: number }).status;
    }
    if (
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
    ) {
      return (error as { statusCode: number }).statusCode;
    }
  }
  return undefined;
}

function formatRawError(error: unknown): string {
  if (error instanceof Error) {
    const status = extractErrorStatus(error);
    const extra = status !== undefined ? ` [status=${status}]` : '';
    return `${error.name}${extra}: ${error.message}`;
  }
  return String(error);
}

function mapGeminiError(error: unknown): never {
  const status = extractErrorStatus(error);
  const rawDetails = formatRawError(error);

  if (status === 401 || status === 403 || status === 402 || status === 404) {
    throw new ProviderConfigurationError(
      'Servizio di generazione temporaneamente non disponibile. Riprova più tardi.',
      503,
      rawDetails
    );
  }

  if (status === 429) {
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

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = extractErrorStatus(error);
      const isNonRetryable =
        status === 400 ||
        status === 401 ||
        status === 402 ||
        status === 403 ||
        status === 404;
      if (isNonRetryable || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

interface RawGeminiUsageMetadata {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  candidatesTokensDetails?: Array<{
    modality?: string;
    tokenCount?: number;
  }>;
}

function extractGeminiTokenCounts(
  metadata: RawGeminiUsageMetadata | undefined,
  mode: 'svg' | 'raster'
) {
  const inputTokens = metadata?.promptTokenCount ?? 0;
  const cachedInputTokens = metadata?.cachedContentTokenCount ?? 0;
  const thoughtsTokens = metadata?.thoughtsTokenCount ?? 0;

  if (mode === 'svg') {
    const textOutputTokens = (metadata?.candidatesTokenCount ?? 0) + thoughtsTokens;
    return {
      inputTokens,
      cachedInputTokens,
      textOutputTokens,
      imageOutputTokens: 0,
    };
  }

  const details = metadata?.candidatesTokensDetails ?? [];
  let imageFromDetails = 0;
  let textFromDetails = 0;
  for (const item of details) {
    const count = item.tokenCount ?? 0;
    if (String(item.modality ?? '').toUpperCase() === 'IMAGE') {
      imageFromDetails += count;
    } else {
      textFromDetails += count;
    }
  }

  const imageOutputTokens =
    imageFromDetails > 0
      ? imageFromDetails
      : (metadata?.candidatesTokenCount ?? 0);
  const textOutputTokens =
    thoughtsTokens + (imageFromDetails > 0 ? textFromDetails : 0);

  return {
    inputTokens,
    cachedInputTokens,
    textOutputTokens,
    imageOutputTokens,
  };
}

export class GeminiColoringProvider implements ColoringProvider {
  readonly id = 'gemini' as const;
  readonly label = 'Google Gemini';
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
    return this.config.geminiApiKey.length > 0;
  }

  getStatus(isDefault: boolean): ProviderStatus {
    const isRaster = IMAGE_OUTPUT_MODELS.has(this.config.geminiModel);
    return {
      id: this.id,
      label: this.label,
      model: this.config.geminiModel,
      configured: this.isConfigured(),
      isDefault,
      tierLabel: isRaster ? 'Modello immagine' : 'Modello gratuito (SVG)',
    };
  }

  async generateColoringPage(
    input: ColoringGenerationInput
  ): Promise<ColoringGenerationOutput> {
    if (!this.isConfigured()) {
      throw new ProviderConfigurationError(
        'Servizio di generazione temporaneamente non disponibile.',
        503,
        'Missing process.env.GEMINI_API_KEY'
      );
    }

    const ai = new GoogleGenAI({
      apiKey: this.config.geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const base64ImageData = input.imageBuffer.toString('base64');
    const model = this.config.geminiModel;

    if (IMAGE_OUTPUT_MODELS.has(model)) {
      return this.generateRasterImage(ai, model, base64ImageData, input);
    }

    return this.generateSvgIllustration(ai, model, base64ImageData, input);
  }

  private async generateRasterImage(
    ai: GoogleGenAI,
    model: string,
    base64ImageData: string,
    input: ColoringGenerationInput
  ): Promise<ColoringGenerationOutput> {
    const { prompt, version: promptVersion } =
      this.promptRepository.buildRasterPrompt(
        input.themeId,
        input.promptVersionOverride
      );
    const startedAt = Date.now();
    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64ImageData,
                  mimeType: input.mimeType,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio: '3:4',
            },
          },
        })
      );
      const latencyMs = Math.max(0, Date.now() - startedAt);
      const counts = extractGeminiTokenCounts(
        response.usageMetadata as RawGeminiUsageMetadata | undefined,
        'raster'
      );
      const usage = this.costEstimator.calculate({
        model,
        ...counts,
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          return {
            provider: this.id,
            model,
            promptVersion,
            outputFormat: 'raster',
            imageDataUrl: `data:${mime};base64,${part.inlineData.data}`,
            sceneSummary: 'Pagina da colorare generata direttamente dalla tua foto.',
            latencyMs,
            usage,
          };
        }
      }

      const finishReason = response.candidates?.[0]?.finishReason ?? 'UNKNOWN';
      const blockReason = response.promptFeedback?.blockReason ?? 'NONE';
      throw new ProviderExecutionError(
        'Il modello immagine non ha restituito alcuna illustrazione. Riprova.',
        502,
        `No inlineData image returned (model=${model}, finishReason=${finishReason}, blockReason=${blockReason}, text=${(response.text ?? '').slice(0, 300)})`
      );
    } catch (error) {
      if (
        error instanceof ProviderConfigurationError ||
        error instanceof ProviderExecutionError
      ) {
        throw error;
      }
      mapGeminiError(error);
    }
  }

  private async generateSvgIllustration(
    ai: GoogleGenAI,
    model: string,
    base64ImageData: string,
    input: ColoringGenerationInput
  ): Promise<ColoringGenerationOutput> {
    const { prompt, version: promptVersion } =
      this.promptRepository.buildSvgPrompt(
        input.themeId,
        input.promptVersionOverride
      );
    const startedAt = Date.now();
    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64ImageData,
                  mimeType: input.mimeType,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                sceneSummary: {
                  type: Type.STRING,
                  description:
                    'Breve descrizione in italiano della scena da colorare creata dalla foto.',
                },
                svgMarkup: {
                  type: Type.STRING,
                  description:
                    'Codice SVG completo (<svg viewBox="0 0 800 1000" ...>...</svg>) in bianco e nero per pagina da colorare.',
                },
              },
              required: ['sceneSummary', 'svgMarkup'],
            },
          },
        })
      );
      const latencyMs = Math.max(0, Date.now() - startedAt);
      const counts = extractGeminiTokenCounts(
        response.usageMetadata as RawGeminiUsageMetadata | undefined,
        'svg'
      );
      const usage = this.costEstimator.calculate({
        model,
        ...counts,
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        const finishReason = response.candidates?.[0]?.finishReason ?? 'UNKNOWN';
        const blockReason = response.promptFeedback?.blockReason ?? 'NONE';
        throw new ProviderExecutionError(
          'Risposta vuota ricevuta dal modello Gemini. Riprova.',
          502,
          `Empty response.text (model=${model}, finishReason=${finishReason}, blockReason=${blockReason})`
        );
      }

      let parsed: { sceneSummary?: string; svgMarkup?: string };
      try {
        parsed = JSON.parse(rawText) as {
          sceneSummary?: string;
          svgMarkup?: string;
        };
      } catch (parseErr) {
        const finishReason = response.candidates?.[0]?.finishReason ?? 'UNKNOWN';
        throw new ProviderExecutionError(
          'Il modello ha restituito un formato non interpretabile. Riprova.',
          502,
          `JSON.parse failed (${parseErr instanceof Error ? parseErr.message : String(parseErr)}, model=${model}, finishReason=${finishReason}): ${rawText.slice(0, 400)}`
        );
      }

      const cleanSvg = sanitizeSvgMarkup(parsed.svgMarkup ?? '');
      const svgBase64 = Buffer.from(cleanSvg, 'utf8').toString('base64');

      return {
        provider: this.id,
        model,
        promptVersion,
        outputFormat: 'svg',
        imageDataUrl: `data:image/svg+xml;base64,${svgBase64}`,
        svgMarkup: cleanSvg,
        sceneSummary:
          parsed.sceneSummary?.trim() ||
          'Pagina da colorare vettoriale generata dalla tua foto.',
        latencyMs,
        usage,
      };
    } catch (error) {
      if (
        error instanceof ProviderConfigurationError ||
        error instanceof ProviderExecutionError
      ) {
        throw error;
      }
      mapGeminiError(error);
    }
  }
}
