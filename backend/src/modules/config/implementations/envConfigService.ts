import type {
  ConfigService,
  ServerConfig,
  SupportedProviderId,
} from '../config.interface.ts';

function parseProvider(value: string | undefined): SupportedProviderId {
  if (value === 'openai') return 'openai';
  return 'gemini';
}

function parseAdminEmails(value: string | undefined): string[] {
  const raw = value?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export class EnvConfigService implements ConfigService {
  getConfig(): ServerConfig {
    const parsedPort = Number(process.env.PORT ?? 3000);
    const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY?.trim() ?? '';
    const appCheckEnabled = process.env.APP_CHECK_ENABLED === 'true';
    const explicitBotRequired = process.env.BOT_PROTECTION_REQUIRED;
    const botProtectionRequired =
      explicitBotRequired === 'true'
        ? true
        : explicitBotRequired === 'false'
          ? false
          : Boolean(turnstileSecretKey || appCheckEnabled);

    return {
      port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000,
      isDevelopment: process.env.NODE_ENV === 'development',
      defaultProvider: parseProvider(process.env.AI_PROVIDER),
      promptVersion: process.env.PROMPT_VERSION?.trim() || '',
      adminEmails: parseAdminEmails(process.env.ADMIN_EMAILS),
      geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
      geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen',
      openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
      openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-image-1',
      turnstileSecretKey,
      appCheckEnabled,
      botProtectionRequired,
    };
  }
}
