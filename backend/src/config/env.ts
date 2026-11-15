export type SupportedProviderId = 'gemini' | 'openai';

export interface ServerConfig {
  port: number;
  defaultProvider: SupportedProviderId;
  promptVersion: string;
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
}

function parseProvider(value: string | undefined): SupportedProviderId {
  if (value === 'openai') return 'openai';
  return 'gemini';
}

export function getServerConfig(): ServerConfig {
  const parsedPort = Number(process.env.PORT ?? 3000);
  return {
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000,
    defaultProvider: parseProvider(process.env.AI_PROVIDER),
    promptVersion: process.env.PROMPT_VERSION?.trim() || '',
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
    geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen',
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
    openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-image-1',
  };
}
