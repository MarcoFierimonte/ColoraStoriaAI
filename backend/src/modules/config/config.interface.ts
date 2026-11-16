import type { ProviderId } from '../../../../shared/types/index.ts';

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
}

export interface ConfigService {
  getConfig(): ServerConfig;
}
