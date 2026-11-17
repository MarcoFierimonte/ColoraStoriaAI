import {
  getServerConfig,
  type ServerConfig,
  type SupportedProviderId,
} from '../../config/index.ts';
import type { PromptRepository } from '../../prompts/promptRepository.interface.ts';
import type {
  AiProviderRegistry,
  ColoringProvider,
  ProviderStatus,
} from '../aiProvider.interface.ts';
import { GeminiColoringProvider } from './geminiColoringProvider.ts';
import { OpenAIColoringProvider } from './openaiColoringProvider.ts';

export class DefaultAiProviderRegistry implements AiProviderRegistry {
  private readonly config: ServerConfig;
  private readonly promptRepository: PromptRepository;

  constructor(params: {
    config?: ServerConfig;
    promptRepository: PromptRepository;
  }) {
    this.config = params.config ?? getServerConfig();
    this.promptRepository = params.promptRepository;
  }

  private buildProviderMap(): Record<SupportedProviderId, ColoringProvider> {
    return {
      gemini: new GeminiColoringProvider({
        config: this.config,
        promptRepository: this.promptRepository,
      }),
      openai: new OpenAIColoringProvider({
        config: this.config,
        promptRepository: this.promptRepository,
      }),
    };
  }

  getProvider(requestedId?: string): ColoringProvider {
    const providers = this.buildProviderMap();
    const id: SupportedProviderId =
      requestedId === 'openai' || requestedId === 'gemini'
        ? requestedId
        : this.config.defaultProvider;
    return providers[id];
  }

  listStatuses(): ProviderStatus[] {
    const providers = this.buildProviderMap();
    return (Object.values(providers) as ColoringProvider[]).map((provider) =>
      provider.getStatus(provider.id === this.config.defaultProvider)
    );
  }
}
