import type { ConfigService, ServerConfig } from './config.interface.ts';
import { EnvConfigService } from './implementations/envConfigService.ts';

export type {
  ConfigService,
  ServerConfig,
  SupportedProviderId,
} from './config.interface.ts';
export { EnvConfigService } from './implementations/envConfigService.ts';

export const configService: ConfigService = new EnvConfigService();

export function getServerConfig(): ServerConfig {
  return configService.getConfig();
}
