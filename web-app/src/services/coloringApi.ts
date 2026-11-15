import type { ThemeId } from '../data/themes';

export type ProviderId = 'gemini' | 'openai';

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  model: string;
  configured: boolean;
  isDefault: boolean;
  tierLabel: string;
}

export interface ColoringGenerationResponse {
  ok: true;
  provider: ProviderId;
  model: string;
  outputFormat: 'svg' | 'raster';
  imageDataUrl: string;
  svgMarkup?: string;
  sceneSummary: string;
}

export async function fetchAvailableProviders(): Promise<ProviderStatus[]> {
  const response = await fetch('/api/providers');
  if (!response.ok) {
    throw new Error('Impossibile verificare i provider AI disponibili.');
  }
  const data = (await response.json()) as { providers?: ProviderStatus[] };
  return data.providers ?? [];
}

export async function generateColoringPageApi(params: {
  file: File;
  themeId: ThemeId;
  providerId?: ProviderId;
}): Promise<ColoringGenerationResponse> {
  const formData = new FormData();
  formData.append('photo', params.file);
  formData.append('theme', params.themeId);
  if (params.providerId) {
    formData.append('provider', params.providerId);
  }

  const response = await fetch('/api/coloring/generate', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | ColoringGenerationResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && 'error' in payload && payload.error
        ? payload.error
        : 'Si è verificato un errore durante la generazione. Riprova.';
    throw new Error(message);
  }

  if (!payload || !('imageDataUrl' in payload)) {
    throw new Error('Risposta non valida ricevuta dal server.');
  }

  return payload;
}
