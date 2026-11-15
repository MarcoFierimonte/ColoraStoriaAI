import { getServerConfig, type SupportedProviderId } from '../config/env.ts';
import { GeminiColoringProvider } from './geminiProvider.ts';
import { OpenAIColoringProvider } from './openaiProvider.ts';
import type { ColoringProvider, ProviderStatus } from './types.ts';

function buildProviderMap(): Record<SupportedProviderId, ColoringProvider> {
  const config = getServerConfig();
  return {
    gemini: new GeminiColoringProvider(config),
    openai: new OpenAIColoringProvider(config),
  };
}

export function getColoringProvider(
  requestedId?: string
): ColoringProvider {
  const config = getServerConfig();
  const providers = buildProviderMap();
  const id: SupportedProviderId =
    requestedId === 'openai' || requestedId === 'gemini'
      ? requestedId
      : config.defaultProvider;
  return providers[id];
}

export function listProviderStatuses(): ProviderStatus[] {
  const config = getServerConfig();
  const providers = buildProviderMap();
  return (Object.values(providers) as ColoringProvider[]).map((provider) =>
    provider.getStatus(provider.id === config.defaultProvider)
  );
}
