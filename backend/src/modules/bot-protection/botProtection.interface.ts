export type BotProtectionMode =
  | 'turnstile'
  | 'app-check'
  | 'admin-bypass'
  | 'disabled';

export interface BotVerificationRequest {
  headers: Record<string, string | string[] | undefined>;
  clientIp?: string;
  isAdmin?: boolean;
}

export interface BotVerificationResult {
  verified: boolean;
  provider: BotProtectionMode;
}

export class BotProtectionError extends Error {
  readonly statusCode: number;
  readonly rawDetails?: string;

  constructor(message: string, statusCode = 403, rawDetails?: string) {
    super(message);
    this.name = 'BotProtectionError';
    this.statusCode = statusCode;
    this.rawDetails = rawDetails;
  }
}

export interface BotProtectionVerifier {
  isEnforced(): boolean;
  verifyRequest(req: BotVerificationRequest): Promise<BotVerificationResult>;
}
