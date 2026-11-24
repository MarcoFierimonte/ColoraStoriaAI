import type {
  NotifyRunEmailRequest,
  PollPendingRunsResponse,
  PromptEvalConfigResponse,
  PromptEvalRunDetail,
  PromptEvalRunResponse,
  PromptEvalRunsListResponse,
  PromptEvalRunSummary,
  ResolvedPromptPreview,
  UpdateItemEvaluationRequest,
  UpdateRunEvaluationRequest,
} from '../../../prompt-eval-core/src/index.ts';
import {
  PromptEvalClientError,
  type CreatePromptEvalRunPayload,
  type PromptEvalApiClient,
} from '../promptEvalClient.interface.ts';

function buildAuthHeaders(idToken: string | null): Record<string, string> {
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const body = isJson
    ? ((await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null)
    : null;

  if (!response.ok) {
    const message =
      body && typeof body.error === 'string'
        ? body.error
        : `Errore dal server (HTTP ${response.status}).`;
    const code =
      body && typeof body.code === 'string' ? body.code : undefined;
    const details =
      body && typeof body.details === 'string' ? body.details : undefined;
    throw new PromptEvalClientError(message, response.status, code, details);
  }

  if (!body) {
    throw new PromptEvalClientError(
      'Risposta non valida dal server.',
      response.status
    );
  }

  return body as unknown as T;
}

export class FetchPromptEvalClient implements PromptEvalApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl = '/api/admin/prompt-eval', fetchImpl?: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
  }

  private async performFetch(
    url: string,
    init: RequestInit,
    hasFileUpload = false
  ): Promise<Response> {
    try {
      return await this.fetchImpl(url, init);
    } catch (err) {
      if (err instanceof PromptEvalClientError) {
        throw err;
      }
      const rawMessage = err instanceof Error ? err.message : String(err);
      const userMessage = hasFileUpload
        ? 'Impossibile inviare i file al server (connessione interrotta oppure file locali spostati/rinominati sul disco). Riprova o riseleziona le immagini.'
        : 'Errore di rete durante la comunicazione con il server. Verifica la connessione e riprova.';
      throw new PromptEvalClientError(
        userMessage,
        0,
        'network_error',
        rawMessage
      );
    }
  }

  async fetchConfig(idToken: string | null): Promise<PromptEvalConfigResponse> {
    const response = await this.performFetch(`${this.baseUrl}/config`, {
      method: 'GET',
      headers: buildAuthHeaders(idToken),
      credentials: 'same-origin',
    });
    return readJsonOrThrow<PromptEvalConfigResponse>(response);
  }

  async resolveCatalogPrompt(
    catalogId: string,
    params: Record<string, string>,
    idToken: string | null
  ): Promise<ResolvedPromptPreview> {
    const response = await this.performFetch(
      `${this.baseUrl}/catalog/resolve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(idToken),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ catalogId, params }),
      }
    );
    return readJsonOrThrow<ResolvedPromptPreview>(response);
  }

  async listRuns(
    idToken: string | null,
    limit = 50
  ): Promise<PromptEvalRunSummary[]> {
    const response = await this.performFetch(
      `${this.baseUrl}/runs?limit=${encodeURIComponent(String(limit))}`,
      {
        method: 'GET',
        headers: buildAuthHeaders(idToken),
        credentials: 'same-origin',
      }
    );
    const data = await readJsonOrThrow<PromptEvalRunsListResponse>(response);
    return data.runs;
  }

  async getRun(
    runId: string,
    idToken: string | null
  ): Promise<PromptEvalRunDetail> {
    const response = await this.performFetch(
      `${this.baseUrl}/runs/${encodeURIComponent(runId)}`,
      {
        method: 'GET',
        headers: buildAuthHeaders(idToken),
        credentials: 'same-origin',
      }
    );
    const data = await readJsonOrThrow<PromptEvalRunResponse>(response);
    return data.run;
  }

  async createRun(
    payload: CreatePromptEvalRunPayload,
    idToken: string | null
  ): Promise<PromptEvalRunDetail> {
    if (payload.modality === 'image') {
      const formData = new FormData();
      formData.append('modality', payload.modality);
      formData.append('executionMode', payload.executionMode);
      formData.append('promptSource', payload.promptSource);
      if (payload.title) formData.append('title', payload.title);
      if (payload.providerId) formData.append('providerId', payload.providerId);
      if (payload.model) formData.append('model', payload.model);
      if (payload.catalogId) formData.append('catalogId', payload.catalogId);
      if (payload.promptParams) {
        formData.append('promptParams', JSON.stringify(payload.promptParams));
      }
      if (payload.customPromptText) {
        formData.append('customPromptText', payload.customPromptText);
      }
      if (payload.notifyEmail) {
        formData.append('notifyEmail', payload.notifyEmail);
      }
      for (const file of payload.files ?? []) {
        formData.append('files', file, file.name);
      }

      const response = await this.performFetch(
        `${this.baseUrl}/runs`,
        {
          method: 'POST',
          headers: buildAuthHeaders(idToken),
          credentials: 'same-origin',
          body: formData,
        },
        true
      );
      const data = await readJsonOrThrow<PromptEvalRunResponse>(response);
      return data.run;
    }

    const response = await this.performFetch(`${this.baseUrl}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(idToken),
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        title: payload.title,
        modality: payload.modality,
        executionMode: payload.executionMode,
        providerId: payload.providerId,
        model: payload.model,
        promptSource: payload.promptSource,
        catalogId: payload.catalogId,
        promptParams: payload.promptParams,
        customPromptText: payload.customPromptText,
        notifyEmail: payload.notifyEmail,
        textInputs: payload.textInputs,
      }),
    });
    const data = await readJsonOrThrow<PromptEvalRunResponse>(response);
    return data.run;
  }

  async refreshBatchRun(
    runId: string,
    idToken: string | null
  ): Promise<PromptEvalRunDetail> {
    const response = await this.performFetch(
      `${this.baseUrl}/runs/${encodeURIComponent(runId)}/refresh`,
      {
        method: 'POST',
        headers: buildAuthHeaders(idToken),
        credentials: 'same-origin',
      }
    );
    const data = await readJsonOrThrow<PromptEvalRunResponse>(response);
    return data.run;
  }

  async cancelBatchRun(
    runId: string,
    idToken: string | null
  ): Promise<PromptEvalRunDetail> {
    const response = await this.performFetch(
      `${this.baseUrl}/runs/${encodeURIComponent(runId)}/cancel`,
      {
        method: 'POST',
        headers: buildAuthHeaders(idToken),
        credentials: 'same-origin',
      }
    );
    const data = await readJsonOrThrow<PromptEvalRunResponse>(response);
    return data.run;
  }

  async notifyRunByEmail(
    runId: string,
    body: NotifyRunEmailRequest,
    idToken: string | null
  ): Promise<PromptEvalRunDetail> {
    const response = await this.performFetch(
      `${this.baseUrl}/runs/${encodeURIComponent(runId)}/notify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(idToken),
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      }
    );
    const data = await readJsonOrThrow<PromptEvalRunResponse>(response);
    return data.run;
  }

  async updateRunEvaluation(
    runId: string,
    patch: UpdateRunEvaluationRequest,
    idToken: string | null
  ): Promise<PromptEvalRunDetail> {
    const response = await this.performFetch(
      `${this.baseUrl}/runs/${encodeURIComponent(runId)}/evaluation`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(idToken),
        },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      }
    );
    const data = await readJsonOrThrow<PromptEvalRunResponse>(response);
    return data.run;
  }

  async updateItemEvaluation(
    runId: string,
    itemId: string,
    patch: UpdateItemEvaluationRequest,
    idToken: string | null
  ): Promise<PromptEvalRunDetail> {
    const response = await this.performFetch(
      `${this.baseUrl}/runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(itemId)}/evaluation`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(idToken),
        },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      }
    );
    const data = await readJsonOrThrow<PromptEvalRunResponse>(response);
    return data.run;
  }

  async deleteRun(runId: string, idToken: string | null): Promise<void> {
    const response = await this.performFetch(
      `${this.baseUrl}/runs/${encodeURIComponent(runId)}`,
      {
        method: 'DELETE',
        headers: buildAuthHeaders(idToken),
        credentials: 'same-origin',
      }
    );
    await readJsonOrThrow<{ ok: boolean }>(response);
  }

  async pollPendingBatchRuns(
    idToken: string | null
  ): Promise<PollPendingRunsResponse> {
    const response = await this.performFetch(`${this.baseUrl}/poll-pending`, {
      method: 'POST',
      headers: buildAuthHeaders(idToken),
      credentials: 'same-origin',
    });
    return readJsonOrThrow<PollPendingRunsResponse>(response);
  }
}
