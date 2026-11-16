import type {
  ConfigService,
  SupportedProviderId,
} from '../../config/config.interface.ts';
import type { CostEstimator } from '../../cost-estimation/costEstimation.interface.ts';
import type { PromptRepository } from '../../prompts/promptRepository.interface.ts';
import type {
  AiProviderRegistry,
  ColoringProvider,
  ProviderStatus,
} from '../aiProvider.interface.ts';
import { GeminiColoringProvider } from './geminiColoringProvider.ts';
import { OpenAIColoringProvider } from './openaiColoringProvider.ts';

export class DefaultAiProviderRegistry implements AiProviderRegistry {
  private readonly configService: ConfigService;
  private readonly promptRepository: PromptRepository;
  private readonly costEstimator: CostEstimator;

  constructor(params: {
    configService: ConfigService;
    promptRepository: PromptRepository;
    costEstimator: CostEstimator;
  }) {
    this.configService = params.configService;
    this.promptRepository = params.promptRepository;
    this.costEstimator = params.costEstimator;
  }

  private buildProviderMap(): Record<SupportedProviderId, ColoringProvider> {
    const config = this.configService.getConfig();
    return {
      gemini: new GeminiColoringProvider({
        config,
        promptRepository: this.promptRepository,
        costEstimator: this.costEstimator,
      }),
      openai: new OpenAIColoringProvider({
        config,
        promptRepository: this.promptRepository,
        costEstimator: this.costEstimator,
      }),
    };
  }

  getProvider(requestedId?: string): ColoringProvider {
    const config = this.configService.getConfig();
    const providers = this.buildProviderMap();
    const id: SupportedProviderId =
      requestedId === 'openai' || requestedId === 'gemini'
        ? requestedId
        : config.defaultProvider;
    return providers[id];
  }

  listStatuses(): ProviderStatus[] {
    const config = this.configService.getConfig();
    const providers = this.buildProviderMap();
    return (Object.values(providers) as ColoringProvider[]).map((provider) =>
      provider.getStatus(provider.id === config.defaultProvider)
    );
  }
}
