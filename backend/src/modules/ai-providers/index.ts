import { serverConfig } from '../config/index.ts';
import { promptRepository } from '../prompts/index.ts';
import type {
  AiProviderRegistry,
  ColoringProvider,
  ProviderStatus,
} from './aiProvider.interface.ts';
import { DefaultAiProviderRegistry } from './implementations/defaultAiProviderRegistry.ts';

export {
  ALLOWED_THEME_IDS,
  ProviderConfigurationError,
  ProviderExecutionError,
  type AiProviderRegistry,
  type ColoringGenerationInput,
  type ColoringGenerationOutput,
  type ColoringProvider,
  type ProviderStatus,
  type ThemeId,
} from './aiProvider.interface.ts';
export { DefaultAiProviderRegistry } from './implementations/defaultAiProviderRegistry.ts';
export { GeminiColoringProvider } from './implementations/geminiColoringProvider.ts';
export { OpenAIColoringProvider } from './implementations/openaiColoringProvider.ts';

export const aiProviderRegistry: AiProviderRegistry =
  new DefaultAiProviderRegistry({
    config: serverConfig,
    promptRepository,
  });

export function getColoringProvider(requestedId?: string): ColoringProvider {
  return aiProviderRegistry.getProvider(requestedId);
}

export function listProviderStatuses(): ProviderStatus[] {
  return aiProviderRegistry.listStatuses();
}
