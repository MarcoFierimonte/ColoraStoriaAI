import {
  parseServerConfig,
  type ServerConfig,
  type SupportedProviderId,
} from './envConfig.ts';

export {
  parseServerConfig,
  type ServerConfig,
  type SupportedProviderId,
};

export const serverConfig: ServerConfig = parseServerConfig();

export function getServerConfig(): ServerConfig {
  return serverConfig;
}
