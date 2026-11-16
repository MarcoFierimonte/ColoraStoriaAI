import {
  ColoringApiError,
  type AdminDebugInfo,
  type AdminErrorDetails,
  type AdminSessionResponse,
  type ColoringApiClient,
  type ColoringGenerationResponse,
  type GenerateColoringPageRequest,
} from '../coloringApi.interface';

export class FetchColoringApiClient implements ColoringApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async fetchAdminSession(
    idToken?: string | null
  ): Promise<AdminSessionResponse> {
    const headers: Record<string, string> = {};
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }
    const response = await fetch(`${this.baseUrl}/admin/session`, {
      headers,
      credentials: 'same-origin',
    });
    if (!response.ok) {
      return {
        authenticated: false,
        isAdmin: false,
        email: null,
        uid: null,
        promptVersions: [],
        activePromptVersion: null,
        providers: [],
      };
    }
    return (await response.json()) as AdminSessionResponse;
  }

  async generateColoringPage(
    params: GenerateColoringPageRequest
  ): Promise<ColoringGenerationResponse> {
    const formData = new FormData();
    formData.append('photo', params.file);
    formData.append('theme', params.themeId);
    if (params.providerId) {
      formData.append('provider', params.providerId);
    }
    if (params.promptVersion) {
      formData.append('promptVersion', params.promptVersion);
    }

    const headers: Record<string, string> = {};
    if (params.idToken) {
      headers.Authorization = `Bearer ${params.idToken}`;
    }
    if (params.turnstileToken) {
      headers['X-Turnstile-Token'] = params.turnstileToken;
    }
    if (params.appCheckToken) {
      headers['X-Firebase-AppCheck'] = params.appCheckToken;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/coloring/generate`, {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: formData,
      });
    } catch (networkErr) {
      const rawMsg =
        networkErr instanceof Error ? networkErr.message : String(networkErr);
      throw new ColoringApiError(
        'Impossibile raggiungere il server per la generazione. Riprova.',
        {
          rawBodySnippet: `Network/Fetch error: ${rawMsg}`,
        }
      );
    }

    const contentType = response.headers.get('content-type');
    const rawText = await response.text().catch(() => '');
    const isProxyCookieCheck =
      Boolean(contentType?.includes('text/html')) &&
      rawText.includes('<title>Cookie check</title>');

    let payload:
      | ColoringGenerationResponse
      | { error?: string; adminErrorDetails?: AdminErrorDetails }
      | null = null;
    let parseErrorMessage: string | null = null;

    if (rawText) {
      try {
        payload = JSON.parse(rawText) as
          | ColoringGenerationResponse
          | { error?: string; adminErrorDetails?: AdminErrorDetails };
      } catch (parseErr) {
        parseErrorMessage =
          parseErr instanceof Error ? parseErr.message : String(parseErr);
      }
    }

    const debugInfo: AdminDebugInfo = {
      statusCode: response.status,
      statusText: response.statusText,
      contentType,
      isProxyCookieCheck,
      backendDetails:
        payload && 'adminErrorDetails' in payload
          ? payload.adminErrorDetails
          : undefined,
      rawBodySnippet:
        parseErrorMessage || !payload || !response.ok
          ? [
              parseErrorMessage ? `JSON parse error: ${parseErrorMessage}` : null,
              rawText ? rawText.slice(0, 1200) : '<empty response body>',
            ]
              .filter(Boolean)
              .join('\n')
          : undefined,
    };

    if (!response.ok) {
      const message =
        payload && 'error' in payload && payload.error
          ? payload.error
          : 'Si è verificato un errore durante la generazione. Riprova.';
      throw new ColoringApiError(message, debugInfo);
    }

    if (!payload || !('imageDataUrl' in payload)) {
      throw new ColoringApiError(
        isProxyCookieCheck
          ? 'Sessione di anteprima scaduta o bloccata dal controllo cookie. Ricarica la pagina e riprova.'
          : 'Risposta non valida ricevuta dal server.',
        debugInfo
      );
    }

    return payload;
  }
}
