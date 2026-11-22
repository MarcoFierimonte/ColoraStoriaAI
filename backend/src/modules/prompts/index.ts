import { serverConfig } from '../config/index.ts';
import { FilesystemPromptRepository } from './implementations/filesystemPromptRepository.ts';
import type {
  BuiltPrompt,
  PromptBuildOptions,
  PromptRepository,
} from './promptRepository.interface.ts';

export type {
  BuiltPrompt,
  PromptBuildOptions,
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
  options: PromptBuildOptions
): BuiltPrompt {
  return promptRepository.buildRasterPrompt(options);
}

export function buildSvgColoringPrompt(
  options: PromptBuildOptions
): BuiltPrompt {
  return promptRepository.buildSvgPrompt(options);
}
