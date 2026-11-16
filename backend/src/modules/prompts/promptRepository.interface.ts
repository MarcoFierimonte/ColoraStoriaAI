import type { ThemeId } from '../ai-providers/aiProvider.interface.ts';

export interface PromptBundle {
  version: string;
  basePrompt: string;
  themes: Record<ThemeId, string>;
  svgAdapter: string;
}

export interface BuiltPrompt {
  prompt: string;
  version: string;
}

export interface PromptRepository {
  listVersions(): string[];
  getActiveVersion(): string;
  buildRasterPrompt(themeId: ThemeId, versionOverride?: string): BuiltPrompt;
  buildSvgPrompt(themeId: ThemeId, versionOverride?: string): BuiltPrompt;
}
