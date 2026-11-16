export interface HttpAuthRequest {
  headers: {
    authorization?: string | string[];
  };
}

export interface AdminAuthContext {
  authenticated: boolean;
  isAdmin: boolean;
  uid?: string;
  email?: string;
}

export interface AuthTokenVerifier {
  verifyOptionalRequest(req: HttpAuthRequest): Promise<AdminAuthContext>;
}
