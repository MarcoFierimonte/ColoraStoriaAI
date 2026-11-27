import {
  estimateTextTokenCount,
  type PromptCatalogDefinition,
  type ResolvedPromptPreview,
} from '../../../../../packages/prompt-eval-core/src/index.ts';
import {
  PromptEvalError,
  type PromptCatalogResolver,
} from '../../../../../packages/prompt-eval-backend/src/index.ts';
import {
  ALLOWED_AGE_GROUPS,
  ALLOWED_COLORING_MODES,
  ALLOWED_THEME_IDS,
  DEFAULT_AGE_GROUP,
  DEFAULT_COLORING_MODE,
  isAllowedThemeId,
  isColoringAgeGroup,
  isColoringStyleMode,
  type ColoringAgeGroup,
  type ColoringStyleMode,
  type ThemeId,
} from '../../../../../shared/config/index.ts';
import type { PromptRepository } from '../../prompts/promptRepository.interface.ts';

export const COLORASTORIA_CATALOG_ID = 'colorastoria-prompts';

const THEME_LABELS: Record<ThemeId, string> = {
  pirati: 'Pirati',
  unicorni: 'Unicorni',
  draghi: 'Draghi',
  spazio: 'Spazio',
  dinosauri: 'Dinosauri',
  principessa: 'Principessa',
};

const AGE_LABELS: Record<ColoringAgeGroup, string> = {
  '1-2': '1–2 anni (semplicissimo)',
  '3-4': '3–4 anni (classico)',
  '5-7': '5–7 anni (dettagliato)',
  '8+': '8+ anni (ricco)',
};

const MODE_LABELS: Record<ColoringStyleMode, string> = {
  fedele: 'Fedele alla foto',
  creativa: 'Creativa con tema',
};

export class ColoraStoriaPromptCatalogResolver implements PromptCatalogResolver {
  private readonly promptRepository: PromptRepository;

  constructor(promptRepository: PromptRepository) {
    this.promptRepository = promptRepository;
  }

  listCatalogs(): PromptCatalogDefinition[] {
    const versions = this.promptRepository.listVersions();
    const activeVersion = this.promptRepository.getActiveVersion();

    return [
      {
        id: COLORASTORIA_CATALOG_ID,
        label: 'Combinazioni ColoraStoria',
        description:
          'Prompt ufficiali versionati (Fedele alla foto oppure Creativa con tema ed età).',
        supportedModalities: ['image'],
        fields: [
          {
            id: 'version',
            label: 'Versione prompt',
            type: 'select',
            required: true,
            defaultValue: activeVersion,
            options: versions.map((v) => ({
              value: v,
              label: v === activeVersion ? `${v} (attiva)` : v,
            })),
          },
          {
            id: 'mode',
            label: 'Modalità',
            type: 'chips',
            required: true,
            defaultValue: DEFAULT_COLORING_MODE,
            options: ALLOWED_COLORING_MODES.map((m) => ({
              value: m,
              label: MODE_LABELS[m],
            })),
          },
          {
            id: 'themeId',
            label: 'Tema illustrato',
            type: 'chips',
            required: true,
            defaultValue: ALLOWED_THEME_IDS[0],
            options: ALLOWED_THEME_IDS.map((t) => ({
              value: t,
              label: THEME_LABELS[t],
            })),
            visibleWhen: {
              fieldId: 'mode',
              values: ['creativa'],
            },
          },
          {
            id: 'ageGroup',
            label: 'Fascia d’età',
            type: 'chips',
            required: true,
            defaultValue: DEFAULT_AGE_GROUP,
            options: ALLOWED_AGE_GROUPS.map((age) => ({
              value: age,
              label: AGE_LABELS[age],
            })),
            visibleWhen: {
              fieldId: 'mode',
              values: ['creativa'],
            },
          },
        ],
      },
    ];
  }

  resolvePrompt(
    catalogId: string,
    params: Record<string, string>
  ): ResolvedPromptPreview {
    return this.resolveInternal(catalogId, params, 0);
  }

  resolveItemPrompt(
    catalogId: string,
    params: Record<string, string>,
    itemIndex: number
  ): string {
    return this.resolveInternal(catalogId, params, itemIndex).promptText;
  }

  private resolveInternal(
    catalogId: string,
    params: Record<string, string>,
    variationIndex: number
  ): ResolvedPromptPreview {
    if (catalogId !== COLORASTORIA_CATALOG_ID) {
      throw new PromptEvalError(
        `Catalogo prompt "${catalogId}" non trovato.`,
        404,
        'catalog_not_found'
      );
    }

    const rawMode = (params.mode ?? DEFAULT_COLORING_MODE).trim();
    if (!isColoringStyleMode(rawMode)) {
      throw new PromptEvalError(
        `Modalità "${rawMode}" non valida.`,
        400,
        'invalid_mode'
      );
    }

    const versionOverride = params.version?.trim() || undefined;

    let themeId: ThemeId | undefined;
    let ageGroup: ColoringAgeGroup | undefined;
    if (rawMode === 'creativa') {
      const rawTheme = (params.themeId ?? ALLOWED_THEME_IDS[0]).trim();
      if (!isAllowedThemeId(rawTheme)) {
        throw new PromptEvalError(
          `Tema "${rawTheme}" non valido per la modalità creativa.`,
          400,
          'invalid_theme'
        );
      }
      themeId = rawTheme;

      const rawAge = (params.ageGroup ?? DEFAULT_AGE_GROUP).trim();
      if (!isColoringAgeGroup(rawAge)) {
        throw new PromptEvalError(
          `Fascia d’età "${rawAge}" non valida.`,
          400,
          'invalid_age_group'
        );
      }
      ageGroup = rawAge;
    }

    let built: { prompt: string; version: string };
    try {
      built = this.promptRepository.buildRasterPrompt({
        mode: rawMode,
        themeId,
        ageGroup,
        versionOverride,
        variationIndex,
      });
    } catch (error) {
      throw new PromptEvalError(
        error instanceof Error
          ? error.message
          : 'Impossibile comporre il prompt richiesto.',
        400,
        'prompt_build_failed'
      );
    }

    const normalizedParams: Record<string, string> =
      rawMode === 'fedele'
        ? {
            version: built.version,
            mode: 'fedele',
          }
        : {
            version: built.version,
            mode: 'creativa',
            themeId: themeId!,
            ageGroup: ageGroup!,
          };

    const label =
      rawMode === 'fedele'
        ? `${built.version} · Fedele`
        : `${built.version} · Creativa · ${THEME_LABELS[themeId!]} · ${ageGroup}`;

    return {
      catalogId,
      promptText: built.prompt,
      label,
      params: normalizedParams,
      metadata: {
        promptVersion: built.version,
        mode: rawMode,
        ...(themeId ? { themeId } : {}),
        ...(ageGroup ? { ageGroup } : {}),
        outputFormat: 'raster',
      },
      charCount: built.prompt.length,
      estimatedTokens: estimateTextTokenCount(built.prompt),
    };
  }
}
