import type { ThemeId } from '../ai-providers/aiProvider.interface.ts';
import { serverConfig } from '../config/index.ts';
import { FilesystemPromptRepository } from './implementations/filesystemPromptRepository.ts';
import type { BuiltPrompt, PromptRepository } from './promptRepository.interface.ts';

export type {
  BuiltPrompt,
  PromptBundle,
  PromptRepository,
} from './promptRepository.interface.ts';
export { FilesystemPromptRepository } from './implementations/filesystemPromptRepository.ts';

export const promptRepository: PromptRepository = new FilesystemPromptRepository(
  serverConfig
);

export function listPromptVersions(): string[] {
  return promptRepository.listVersions();
}

export function getActivePromptVersion(): string {
  return promptRepository.getActiveVersion();
}

export function buildRasterColoringPrompt(
  themeId: ThemeId,
  versionOverride?: string
): BuiltPrompt {
  return promptRepository.buildRasterPrompt(themeId, versionOverride);
}

export function buildSvgColoringPrompt(
  themeId: ThemeId,
  versionOverride?: string
): BuiltPrompt {
  return promptRepository.buildSvgPrompt(themeId, versionOverride);
}
