import type {
  ColoringAgeGroup,
  ColoringStyleMode,
  ThemeId,
} from '../ai-providers/aiProvider.interface.ts';

export interface StructuredThemePrompt {
  setting: string;
  costume?: string;
  variants: string[];
  secondaryDetails?: string;
}

export type ThemePromptEntry = string | StructuredThemePrompt;

export interface PromptBundle {
  version: string;
  basePrompt: string;
  themes: Record<ThemeId, ThemePromptEntry>;
  modes?: Record<ColoringStyleMode, string>;
  ages?: Record<ColoringAgeGroup, string>;
  svgAdapter: string;
}

export interface PromptBuildOptions {
  mode: ColoringStyleMode;
  themeId?: ThemeId;
  ageGroup?: ColoringAgeGroup;
  versionOverride?: string;
  /** Optional deterministic variant index (rotates through structured theme variants). */
  variationIndex?: number;
}

export interface BuiltPrompt {
  prompt: string;
  version: string;
}

export interface PromptRepository {
  listVersions(): string[];
  getActiveVersion(): string;
  buildRasterPrompt(options: PromptBuildOptions): BuiltPrompt;
  buildSvgPrompt(options: PromptBuildOptions): BuiltPrompt;
}
