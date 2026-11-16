import type { ProviderId } from '../../../../shared/types/index.ts';

export type SupportedProviderId = ProviderId;

export interface ServerConfig {
  port: number;
  defaultProvider: SupportedProviderId;
  promptVersion: string;
  adminEmails: string[];
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
}

export interface ConfigService {
  getConfig(): ServerConfig;
}
