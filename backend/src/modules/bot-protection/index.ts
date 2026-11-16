import { configService } from '../config/index.ts';
import type { BotProtectionVerifier } from './botProtection.interface.ts';
import { DefaultBotProtectionVerifier } from './implementations/defaultBotProtectionVerifier.ts';

export {
  BotProtectionError,
  type BotProtectionMode,
  type BotProtectionVerifier,
  type BotVerificationRequest,
  type BotVerificationResult,
} from './botProtection.interface.ts';
export { DefaultBotProtectionVerifier } from './implementations/defaultBotProtectionVerifier.ts';

export const botProtectionVerifier: BotProtectionVerifier =
  new DefaultBotProtectionVerifier(configService);
