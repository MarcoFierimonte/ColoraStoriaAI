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
    const fallbackSession: AdminSessionResponse = {
      authenticated: false,
      isAdmin: false,
      hasAdminClaim: false,
      email: null,
      uid: null,
      promptVersions: [],
      activePromptVersion: null,
      providers: [],
    };

    try {
      const response = await fetch(`${this.baseUrl}/admin/session`, {
        headers,
        credentials: 'include',
      });
      const contentType = response.headers.get('content-type') ?? '';
      if (
        !response.ok ||
        !contentType.toLowerCase().includes('application/json')
      ) {
        return fallbackSession;
      }
      return (await response.json()) as AdminSessionResponse;
    } catch {
      return fallbackSession;
    }
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

    // Warm the preview proxy session cache with a bodyless GET before sending multipart POST,
    // and catch any 302 auth redirect cleanly before it turns into a cross-origin CORS failure.
    try {
      const healthResponse = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        credentials: 'include',
        redirect: 'manual',
      });
      const healthCt = healthResponse.headers.get('content-type') ?? '';
      if (
        healthResponse.type === 'opaqueredirect' ||
        healthCt.toLowerCase().includes('text/html')
      ) {
        console.error('[ColoringApiClient] Health pre-check intercepted by proxy:', {
          status: healthResponse.status,
          type: healthResponse.type,
          contentType: healthCt,
        });
        throw new ColoringApiError(
          'Sessione di anteprima scaduta o bloccata dal controllo cookie/proxy. Ricarica la pagina e riprova.',
          {
            statusCode: healthResponse.status,
            statusText:
              healthResponse.type === 'opaqueredirect'
                ? 'opaqueredirect'
                : healthResponse.statusText,
            contentType: healthCt || null,
            isProxyCookieCheck: true,
            rawBodySnippet:
              'Pre-check GET /api/health intercepted by preview proxy redirect/HTML.',
          }
        );
      }
    } catch (preErr) {
      if (preErr instanceof ColoringApiError) {
        throw preErr;
      }
      const rawPreMsg =
        preErr instanceof Error ? preErr.message : String(preErr);
      console.error('[ColoringApiClient] Health pre-check network error:', rawPreMsg);
      throw new ColoringApiError(
        'Impossibile raggiungere il server per la generazione. Riprova.',
        {
          rawBodySnippet: `Network/Fetch pre-check error: ${rawPreMsg}`,
        }
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/coloring/generate`, {
        method: 'POST',
        headers,
        credentials: 'include',
        redirect: 'manual',
        body: formData,
      });
    } catch (networkErr) {
      const rawMsg =
        networkErr instanceof Error ? networkErr.message : String(networkErr);
      console.error('[ColoringApiClient] Network error:', rawMsg);
      throw new ColoringApiError(
        'Impossibile raggiungere il server per la generazione. Riprova.',
        {
          rawBodySnippet: `Network/Fetch error: ${rawMsg}`,
        }
      );
    }

    const isOpaqueRedirect = response.type === 'opaqueredirect';
    const contentType = response.headers.get('content-type') ?? '';
    const isHtmlResponse = contentType.toLowerCase().includes('text/html');
    const rawText = isOpaqueRedirect
      ? ''
      : await response.text().catch(() => '');
    const isProxyCookieCheck =
      isOpaqueRedirect ||
      isHtmlResponse ||
      rawText.includes('<title>Cookie check</title>') ||
      rawText.includes('applet-auth-bridge') ||
      (response.redirected &&
        !contentType.toLowerCase().includes('application/json'));

    let payload:
      | ColoringGenerationResponse
      | { error?: string; adminErrorDetails?: AdminErrorDetails }
      | null = null;
    let parseErrorMessage: string | null = null;

    if (rawText && !isHtmlResponse) {
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
      statusText: isOpaqueRedirect ? 'opaqueredirect' : response.statusText,
      contentType: contentType || null,
      isProxyCookieCheck,
      backendDetails:
        payload && 'adminErrorDetails' in payload
          ? payload.adminErrorDetails
          : undefined,
      rawBodySnippet:
        isOpaqueRedirect || parseErrorMessage || !payload || !response.ok
          ? [
              isOpaqueRedirect
                ? 'HTTP 3xx redirect intercepted on POST /api/coloring/generate.'
                : null,
              parseErrorMessage ? `JSON parse error: ${parseErrorMessage}` : null,
              rawText ? rawText.slice(0, 1200) : '<empty response body>',
            ]
              .filter(Boolean)
              .join('\n')
          : undefined,
    };

    if (isProxyCookieCheck) {
      console.error('[ColoringApiClient] Proxy/HTML interception:', {
        status: response.status,
        type: response.type,
        redirected: response.redirected,
        contentType,
        snippet: rawText.slice(0, 200),
      });
      throw new ColoringApiError(
        'Sessione di anteprima scaduta o bloccata dal controllo cookie/proxy. Ricarica la pagina e riprova.',
        debugInfo
      );
    }

    if (!response.ok) {
      const message =
        payload && 'error' in payload && payload.error
          ? payload.error
          : `Si è verificato un errore durante la generazione (HTTP ${response.status}). Riprova.`;
      if (!payload || !('error' in payload) || !payload.error) {
        console.error('[ColoringApiClient] Non-JSON error response:', {
          status: response.status,
          contentType,
          snippet: rawText.slice(0, 200),
        });
      }
      throw new ColoringApiError(message, debugInfo);
    }

    if (!payload || !('imageDataUrl' in payload)) {
      console.error('[ColoringApiClient] Invalid JSON response from server:', {
        status: response.status,
        contentType,
        parseErrorMessage,
        snippet: rawText.slice(0, 200),
      });
      throw new ColoringApiError(
        `Risposta non valida ricevuta dal server (HTTP ${response.status}, ${contentType ?? 'formato sconosciuto'}).`,
        debugInfo
      );
    }

    return payload;
  }
}
