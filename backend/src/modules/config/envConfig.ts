import { z } from 'zod';
import {
  SUPPORTED_PROVIDER_IDS,
  type ProviderId,
} from '../../../../shared/config/index.ts';

export type SupportedProviderId = ProviderId;

export interface ServerConfig {
  port: number;
  isDevelopment: boolean;
  defaultProvider: SupportedProviderId;
  promptVersion: string;
  adminEmails: string[];
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
  turnstileSecretKey: string;
  appCheckEnabled: boolean;
  botProtectionRequired: boolean;
  betaInviteRequired: boolean;
  betaSessionSecret: string;
}

const rawEnvSchema = z.object({
  PORT: z.preprocess(
    (val) => (val === undefined || String(val).trim() === '' ? '3000' : val),
    z.coerce
      .number({ error: 'PORT deve essere un numero intero valido.' })
      .int()
      .min(1)
      .max(65535)
  ),
  NODE_ENV: z.string().optional(),
  AI_PROVIDER: z.preprocess(
    (val) => {
      const trimmed = typeof val === 'string' ? val.trim() : '';
      return trimmed === '' ? 'gemini' : trimmed;
    },
    z.enum(SUPPORTED_PROVIDER_IDS)
  ),
  PROMPT_VERSION: z.string().optional().default(''),
  ADMIN_EMAILS: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().optional().default(''),
  TURNSTILE_SECRET_KEY: z.string().optional().default(''),
  APP_CHECK_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .default('false'),
  BOT_PROTECTION_REQUIRED: z.enum(['true', 'false', '']).optional().default(''),
  BETA_INVITE_REQUIRED: z
    .enum(['true', 'false', ''])
    .optional()
    .default('false'),
  BETA_SESSION_SECRET: z.string().optional().default(''),
});

const emailSchema = z.string().email();

function parseAdminEmails(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const emails = trimmed
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  for (const email of emails) {
    const check = emailSchema.safeParse(email);
    if (!check.success) {
      throw new Error(
        `Invalid server environment configuration: ADMIN_EMAILS contains invalid email "${email}".`
      );
    }
  }

  return emails;
}

function readCliPort(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) {
      return argv[i + 1];
    }
    if (arg.startsWith('--port=')) {
      return arg.slice('--port='.length);
    }
  }
  return undefined;
}

export function parseServerConfig(
  env: Record<string, string | undefined> = process.env,
  argv: readonly string[] = process.argv
): ServerConfig {
  const cliPort = readCliPort(argv);
  const effectiveEnv =
    cliPort !== undefined ? { ...env, PORT: cliPort } : env;

  const parsed = rawEnvSchema.safeParse(effectiveEnv);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid server environment configuration: ${issues}`);
  }

  const data = parsed.data;
  const turnstileSecretKey = data.TURNSTILE_SECRET_KEY.trim();
  const appCheckEnabled = data.APP_CHECK_ENABLED === 'true';
  const botProtectionRequired =
    data.BOT_PROTECTION_REQUIRED === 'true'
      ? true
      : data.BOT_PROTECTION_REQUIRED === 'false'
        ? false
        : Boolean(turnstileSecretKey || appCheckEnabled);

  if (botProtectionRequired && !turnstileSecretKey && !appCheckEnabled) {
    throw new Error(
      'Invalid server environment configuration: BOT_PROTECTION_REQUIRED=true requires TURNSTILE_SECRET_KEY or APP_CHECK_ENABLED=true.'
    );
  }

  const isDevelopment = data.NODE_ENV === 'development';
  const betaInviteRequired = data.BETA_INVITE_REQUIRED === 'true';
  let betaSessionSecret = data.BETA_SESSION_SECRET.trim();

  if (betaInviteRequired && !isDevelopment && betaSessionSecret.length < 16) {
    throw new Error(
      'Invalid server environment configuration: BETA_INVITE_REQUIRED=true in production requires BETA_SESSION_SECRET (>= 16 chars).'
    );
  }

  if (betaInviteRequired && isDevelopment && !betaSessionSecret) {
    betaSessionSecret = 'dev-only-beta-session-secret-change-me';
  }

  return {
    port: data.PORT,
    isDevelopment,
    defaultProvider: data.AI_PROVIDER,
    promptVersion: data.PROMPT_VERSION.trim(),
    adminEmails: parseAdminEmails(data.ADMIN_EMAILS),
    geminiApiKey: data.GEMINI_API_KEY.trim(),
    geminiModel: data.GEMINI_MODEL.trim() || 'gemini-nano-banana-2.1',
    openaiApiKey: data.OPENAI_API_KEY.trim(),
    openaiModel: data.OPENAI_MODEL.trim() || 'gpt-image-1',
    turnstileSecretKey,
    appCheckEnabled,
    botProtectionRequired,
    betaInviteRequired,
    betaSessionSecret,
  };
}
