import type { PromptEvalProviderInfo } from '../../../prompt-eval-core/src/index.ts';
import {
  PromptEvalError,
  type PromptExecutionProvider,
  type PromptProviderRegistry,
} from '../promptEval.interface.ts';

export class DefaultPromptProviderRegistry implements PromptProviderRegistry {
  private readonly providers: Map<string, PromptExecutionProvider>;
  private readonly defaultProviderId: string;

  constructor(params: {
    providers: readonly PromptExecutionProvider[];
    defaultProviderId: string;
  }) {
    this.providers = new Map();
    for (const provider of params.providers) {
      this.providers.set(provider.id, provider);
    }
    this.defaultProviderId = params.defaultProviderId;
  }

  getProvider(providerId?: string): PromptExecutionProvider {
    const requested = providerId?.trim() || this.defaultProviderId;
    const provider = this.providers.get(requested);
    if (!provider) {
      const available = [...this.providers.keys()].join(', ');
      throw new PromptEvalError(
        `Provider "${requested}" non supportato. Disponibili: ${available}.`,
        400,
        'unsupported_provider'
      );
    }
    return provider;
  }

  listProviders(): PromptEvalProviderInfo[] {
    return [...this.providers.values()].map((provider) =>
      provider.getInfo(provider.id === this.defaultProviderId)
    );
  }
}
