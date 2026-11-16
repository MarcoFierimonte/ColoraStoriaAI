import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { ConfigService } from '../../config/config.interface.ts';
import type {
  AdminAuthContext,
  AuthTokenVerifier,
  HttpAuthRequest,
} from '../auth.interface.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_FIREBASE_CONFIG_PATH = path.resolve(
  __dirname,
  '../../../../../firebase-applet-config.json'
);

export class FirebaseAdminTokenVerifier implements AuthTokenVerifier {
  private readonly configService: ConfigService;
  private readonly firebaseConfigPath: string;
  private firebaseInitialized = false;

  constructor(
    configService: ConfigService,
    firebaseConfigPath = DEFAULT_FIREBASE_CONFIG_PATH
  ) {
    this.configService = configService;
    this.firebaseConfigPath = firebaseConfigPath;
  }

  private ensureFirebaseAdmin(): boolean {
    if (this.firebaseInitialized || getApps().length > 0) {
      this.firebaseInitialized = true;
      return true;
    }

    try {
      if (!fs.existsSync(this.firebaseConfigPath)) {
        return false;
      }
      const raw = fs.readFileSync(this.firebaseConfigPath, 'utf8');
      const parsed = JSON.parse(raw) as { projectId?: string };
      if (!parsed.projectId) {
        return false;
      }
      initializeApp({ projectId: parsed.projectId });
      this.firebaseInitialized = true;
      return true;
    } catch (err) {
      console.error('Failed to initialize firebase-admin:', err);
      return false;
    }
  }

  async verifyOptionalRequest(req: HttpAuthRequest): Promise<AdminAuthContext> {
    const rawHeader = req.headers.authorization;
    const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, isAdmin: false };
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return { authenticated: false, isAdmin: false };
    }

    if (!this.ensureFirebaseAdmin()) {
      return { authenticated: false, isAdmin: false };
    }

    try {
      const decoded = await getAuth().verifyIdToken(token);
      const email = decoded.email?.toLowerCase();
      const emailVerified = decoded.email_verified === true;
      const { adminEmails } = this.configService.getConfig();
      const hasAdminClaim = decoded.admin === true;
      const hasAdminEmail = Boolean(
        email && adminEmails.includes(email)
      );

      const isAdmin = Boolean(emailVerified && (hasAdminClaim || hasAdminEmail));

      return {
        authenticated: true,
        isAdmin,
        uid: decoded.uid,
        email: decoded.email,
      };
    } catch {
      return { authenticated: false, isAdmin: false };
    }
  }
}
