import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getServerConfig, type ServerConfig } from '../../config/index.ts';
import {
  BotProtectionError,
  type BotVerificationRequest,
  type BotVerificationResult,
  type BotProtectionVerifier,
} from '../botProtection.interface.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_FIREBASE_CONFIG_PATH = path.resolve(
  __dirname,
  '../../../../../firebase-applet-config.json'
);

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return (value[0] ?? '').trim();
  return (value ?? '').trim();
}

export class DefaultBotProtectionVerifier implements BotProtectionVerifier {
  private readonly config: ServerConfig;
  private readonly firebaseConfigPath: string;

  constructor(
    config: ServerConfig = getServerConfig(),
    firebaseConfigPath = DEFAULT_FIREBASE_CONFIG_PATH
  ) {
    this.config = config;
    this.firebaseConfigPath = firebaseConfigPath;
  }

  private ensureFirebaseApp(): boolean {
    if (getApps().length > 0) return true;
    try {
      if (!fs.existsSync(this.firebaseConfigPath)) return false;
      const raw = JSON.parse(
        fs.readFileSync(this.firebaseConfigPath, 'utf8')
      ) as { projectId?: string };
      if (!raw.projectId) return false;
      initializeApp({ projectId: raw.projectId });
      return true;
    } catch {
      return false;
    }
  }

  isEnforced(): boolean {
    return this.config.botProtectionRequired;
  }

  async verifyRequest(
    req: BotVerificationRequest
  ): Promise<BotVerificationResult> {
    if (req.isAdmin) {
      return { verified: true, provider: 'admin-bypass' };
    }

    if (!this.config.botProtectionRequired) {
      return { verified: true, provider: 'disabled' };
    }

    if (this.config.turnstileSecretKey) {
      const token = readHeader(req.headers, 'x-turnstile-token');
      if (!token) {
        throw new BotProtectionError(
          'Verifica di sicurezza richiesta prima di generare la pagina.',
          403,
          'Missing x-turnstile-token header'
        );
      }

      try {
        const body = new URLSearchParams({
          secret: this.config.turnstileSecretKey,
          response: token,
        });
        if (req.clientIp) {
          body.set('remoteip', req.clientIp);
        }
        const response = await fetch(TURNSTILE_VERIFY_URL, {
          method: 'POST',
          body,
        });
        const result = (await response.json()) as {
          success?: boolean;
          'error-codes'?: string[];
        };
        if (!response.ok || !result.success) {
          throw new BotProtectionError(
            'Verifica di sicurezza non superata. Ricarica la pagina e riprova.',
            403,
            `Turnstile rejected token: ${JSON.stringify(result['error-codes'] ?? response.status)}`
          );
        }
        return { verified: true, provider: 'turnstile' };
      } catch (err) {
        if (err instanceof BotProtectionError) throw err;
        throw new BotProtectionError(
          'Verifica di sicurezza temporaneamente non disponibile. Riprova.',
          503,
          `Turnstile verification error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (this.config.appCheckEnabled) {
      const token = readHeader(req.headers, 'x-firebase-appcheck');
      if (!token) {
        throw new BotProtectionError(
          'Verifica di sicurezza richiesta prima di generare la pagina.',
          403,
          'Missing x-firebase-appcheck header'
        );
      }
      if (!this.ensureFirebaseApp()) {
        throw new BotProtectionError(
          'Verifica di sicurezza temporaneamente non disponibile.',
          503,
          'Firebase Admin could not be initialized for App Check'
        );
      }
      try {
        await getAppCheck().verifyToken(token);
        return { verified: true, provider: 'app-check' };
      } catch (err) {
        throw new BotProtectionError(
          'Verifica di sicurezza non superata. Ricarica la pagina e riprova.',
          403,
          `App Check rejected token: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (this.config.botProtectionRequired) {
      throw new BotProtectionError(
        'Protezione anti-bot non configurata sul server.',
        503,
        'BOT_PROTECTION_REQUIRED=true without TURNSTILE_SECRET_KEY or APP_CHECK_ENABLED=true'
      );
    }

    return { verified: true, provider: 'disabled' };
  }
}
