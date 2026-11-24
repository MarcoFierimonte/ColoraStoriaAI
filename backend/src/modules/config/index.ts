import {
  parseServerConfig,
  type EmailProviderId,
  type PromptEvalStoreMode,
  type ServerConfig,
  type SupportedProviderId,
} from './envConfig.ts';

export {
  parseServerConfig,
  type EmailProviderId,
  type PromptEvalStoreMode,
  type ServerConfig,
  type SupportedProviderId,
};

export const serverConfig: ServerConfig = parseServerConfig();

export function getServerConfig(): ServerConfig {
  return serverConfig;
}
