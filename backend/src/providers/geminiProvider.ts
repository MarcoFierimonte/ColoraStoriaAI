import { GoogleGenAI, Type } from '@google/genai';
import type { ServerConfig } from '../config/env.ts';
import {
  buildRasterColoringPrompt,
  buildSvgColoringPrompt,
} from '../utils/prompts.ts';
import {
  ProviderConfigurationError,
  ProviderExecutionError,
  type ColoringGenerationInput,
  type ColoringGenerationOutput,
  type ColoringProvider,
  type ProviderStatus,
} from './types.ts';

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
      'Il modello non ha restituito un disegno SVG valido. Riprova tra un istante.'
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

function mapGeminiError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('403')
  ) {
    throw new ProviderConfigurationError(
      'Chiave Gemini API non valida o mancante nelle impostazioni del server (Settings > Secrets).',
      403
    );
  }

  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    throw new ProviderExecutionError(
      'Limite momentaneo di richieste Gemini raggiunto. Attendi qualche secondo e riprova.',
      429
    );
  }

  if (lower.includes('not_found') || lower.includes('404')) {
    throw new ProviderExecutionError(
      'Il modello Gemini configurato non è disponibile. Verifica GEMINI_MODEL sul server.',
      404
    );
  }

  throw new ProviderExecutionError(
    'Errore durante la generazione con Gemini. Riprova tra qualche istante.',
    502
  );
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      const isClientOrKeyError =
        msg.includes('api_key_invalid') ||
        msg.includes('permission_denied') ||
        msg.includes('not_found') ||
        msg.includes('400') ||
        msg.includes('403') ||
        msg.includes('404');
      if (isClientOrKeyError || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

export class GeminiColoringProvider implements ColoringProvider {
  readonly id = 'gemini' as const;
  readonly label = 'Google Gemini';
  private readonly config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
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
        'GEMINI_API_KEY non è ancora configurata sul server. Aggiungila in Settings > Secrets per provare la generazione dal vivo.',
        503
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
                text: buildRasterColoringPrompt(input.themeId),
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

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          return {
            provider: this.id,
            model,
            outputFormat: 'raster',
            imageDataUrl: `data:${mime};base64,${part.inlineData.data}`,
            sceneSummary: 'Pagina da colorare generata direttamente dalla tua foto.',
          };
        }
      }

      throw new ProviderExecutionError(
        'Il modello immagine non ha restituito alcuna illustrazione. Riprova.'
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
                text: buildSvgColoringPrompt(input.themeId),
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

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new ProviderExecutionError(
          'Risposta vuota ricevuta dal modello Gemini. Riprova.'
        );
      }

      const parsed = JSON.parse(rawText) as {
        sceneSummary?: string;
        svgMarkup?: string;
      };

      const cleanSvg = sanitizeSvgMarkup(parsed.svgMarkup ?? '');
      const svgBase64 = Buffer.from(cleanSvg, 'utf8').toString('base64');

      return {
        provider: this.id,
        model,
        outputFormat: 'svg',
        imageDataUrl: `data:image/svg+xml;base64,${svgBase64}`,
        svgMarkup: cleanSvg,
        sceneSummary:
          parsed.sceneSummary?.trim() ||
          'Pagina da colorare vettoriale generata dalla tua foto.',
      };
    } catch (error) {
      if (
        error instanceof ProviderConfigurationError ||
        error instanceof ProviderExecutionError
      ) {
        throw error;
      }
      if (error instanceof SyntaxError) {
        throw new ProviderExecutionError(
          'Il modello ha restituito un formato non interpretabile. Riprova.'
        );
      }
      mapGeminiError(error);
    }
  }
}
