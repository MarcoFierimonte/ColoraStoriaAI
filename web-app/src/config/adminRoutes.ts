export type AdminServiceTab = 'prompt-lab' | 'invites' | 'telemetry';

export const ADMIN_BASE_PATH = '/admin';

export const ADMIN_TABS: Array<{
  id: AdminServiceTab;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'prompt-lab',
    label: 'Laboratorio Prompt & Batch API',
    shortLabel: 'Prompt & Batch',
    description:
      'Testa i prompt su più immagini con API Standard o Batch (-50%), scarica i risultati, ricevi email e salva note.',
  },
  {
    id: 'invites',
    label: 'Gestione Inviti Beta',
    shortLabel: 'Inviti Beta',
    description:
      'Crea codici personali, gestisci quote di generazioni, scadenze e link rapidi.',
  },
  {
    id: 'telemetry',
    label: 'Telemetria & Costi',
    shortLabel: 'Telemetria',
    description:
      'Consulta i costi delle singole generazioni, la stima libro e lo storico su Firestore.',
  },
];

export function isAdminPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  return normalized === ADMIN_BASE_PATH;
}

export function parseAdminTabFromSearch(search: string): AdminServiceTab {
  const params = new URLSearchParams(search);
  const raw = params.get('tab')?.trim().toLowerCase();
  if (raw === 'invites' || raw === 'telemetry' || raw === 'prompt-lab') {
    return raw;
  }
  return 'prompt-lab';
}

export function parseAdminRunIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get('run')?.trim();
  return raw || null;
}

export function buildAdminUrl(
  tab: AdminServiceTab,
  runId?: string | null
): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (tab === 'prompt-lab' && runId) {
    params.set('run', runId);
  }
  return `${ADMIN_BASE_PATH}?${params.toString()}`;
}
