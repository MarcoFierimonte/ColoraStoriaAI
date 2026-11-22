import {
  BetaAccessApiError,
  type AccessSessionResponse,
  type AdminInviteMutationResponse,
  type AdminInvitesListResponse,
  type BetaAccessClient,
  type BetaInviteSummary,
  type CreateInviteRequest,
  type RedeemInviteRequest,
  type UpdateInviteRequest,
} from '../betaAccess.interface';

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const body = isJson
    ? ((await response.json().catch(() => null)) as Record<string, unknown> | null)
    : null;

  if (!response.ok) {
    const message =
      body && typeof body.error === 'string'
        ? body.error
        : `Si è verificato un errore (HTTP ${response.status}). Riprova.`;
    throw new BetaAccessApiError(message, response.status);
  }

  if (!body) {
    throw new BetaAccessApiError(
      'Risposta non valida dal server.',
      response.status
    );
  }

  return body as unknown as T;
}

function buildAuthHeaders(idToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  return headers;
}

export class FetchBetaAccessClient implements BetaAccessClient {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async fetchAccessSession(
    idToken?: string | null
  ): Promise<AccessSessionResponse> {
    const fallback: AccessSessionResponse = {
      inviteRequired: true,
      hasAccess: false,
      accessSource: 'none',
      invite: null,
    };

    try {
      const response = await fetch(`${this.baseUrl}/access/session`, {
        method: 'GET',
        headers: buildAuthHeaders(idToken),
        credentials: 'same-origin',
      });
      if (!response.ok) return fallback;
      return await readJsonOrThrow<AccessSessionResponse>(response);
    } catch {
      return fallback;
    }
  }

  async redeemInvite(code: string): Promise<AccessSessionResponse> {
    const payload: RedeemInviteRequest = { code };
    const response = await fetch(`${this.baseUrl}/access/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    return readJsonOrThrow<AccessSessionResponse>(response);
  }

  async logoutInvite(): Promise<void> {
    await fetch(`${this.baseUrl}/access/logout`, {
      method: 'POST',
      credentials: 'same-origin',
    });
  }

  async listAdminInvites(idToken: string | null): Promise<BetaInviteSummary[]> {
    const response = await fetch(`${this.baseUrl}/admin/invites`, {
      method: 'GET',
      headers: buildAuthHeaders(idToken),
      credentials: 'same-origin',
    });
    const data = await readJsonOrThrow<AdminInvitesListResponse>(response);
    return data.invites;
  }

  async createAdminInvite(
    input: CreateInviteRequest,
    idToken: string | null
  ): Promise<BetaInviteSummary> {
    const response = await fetch(`${this.baseUrl}/admin/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(idToken),
      },
      credentials: 'same-origin',
      body: JSON.stringify(input),
    });
    const data = await readJsonOrThrow<AdminInviteMutationResponse>(response);
    return data.invite;
  }

  async updateAdminInvite(
    code: string,
    input: UpdateInviteRequest,
    idToken: string | null
  ): Promise<BetaInviteSummary> {
    const response = await fetch(
      `${this.baseUrl}/admin/invites/${encodeURIComponent(code)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(idToken),
        },
        credentials: 'same-origin',
        body: JSON.stringify(input),
      }
    );
    const data = await readJsonOrThrow<AdminInviteMutationResponse>(response);
    return data.invite;
  }

  async deleteAdminInvite(
    code: string,
    idToken: string | null
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/admin/invites/${encodeURIComponent(code)}`,
      {
        method: 'DELETE',
        headers: buildAuthHeaders(idToken),
        credentials: 'same-origin',
      }
    );
    await readJsonOrThrow<{ ok: boolean }>(response);
  }
}
