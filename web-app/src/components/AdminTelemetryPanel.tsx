import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-react';
import { ORDER_CONFIG } from '../config/orderConfig';
import { useAuth } from '../modules/auth';
import {
  deleteAdminTelemetryLogApi,
  fetchAdminTelemetryLogsApi,
  type AdminTelemetry,
} from '../modules/coloring-api';
import {
  deleteGenerationLog,
  subscribeGenerationLogs,
  type GenerationLogRecord,
} from '../modules/database';
import { TempModelCostEstimatorPanel } from './TempModelCostEstimatorPanel';
import { UiBadge, UiCard } from './ui';

interface AdminTelemetryPanelProps {
  latestTelemetry: AdminTelemetry | null;
}

type TelemetrySourceFilter =
  | 'all'
  | 'creator'
  | 'prompt_lab_standard'
  | 'prompt_lab_batch';

function formatUsd(amount: number, digits = 5): string {
  return `$${amount.toFixed(digits)}`;
}

function formatDateTime(ms: number | null): string {
  if (!ms) return 'In sincronizzazione...';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function AdminTelemetryPanel({
  latestTelemetry,
}: AdminTelemetryPanelProps) {
  const { user, authReady, isAdmin, hasAdminClaim, idToken, refreshIdToken } =
    useAuth();
  const [logs, setLogs] = useState<GenerationLogRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [sourceFilter, setSourceFilter] =
    useState<TelemetrySourceFilter>('all');
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  const idTokenRef = useRef<string | null>(idToken);
  useEffect(() => {
    idTokenRef.current = idToken;
  }, [idToken]);

  const loadLogsFromServer = useCallback(async () => {
    if (!authReady || !isAdmin || !user) return;
    setIsLoadingLogs(true);
    try {
      const freshToken = (await refreshIdToken(false)) ?? idTokenRef.current;
      const items = await fetchAdminTelemetryLogsApi(freshToken, 100);
      setLogs(items);
      setLogsError(null);
    } catch (err) {
      setLogsError(
        err instanceof Error
          ? err.message
          : 'Impossibile caricare i log di telemetria.'
      );
    } finally {
      setIsLoadingLogs(false);
    }
  }, [authReady, isAdmin, user, refreshIdToken]);

  useEffect(() => {
    if (!authReady || !isAdmin || !user) {
      setLogs([]);
      setLogsError(null);
      return;
    }

    let cancelled = false;
    let unsubscribeSnapshot: (() => void) | null = null;

    void (async () => {
      // Initial server load also backfills any previously completed Prompt Lab runs
      await loadLogsFromServer();
      if (cancelled || !hasAdminClaim) {
        return;
      }

      unsubscribeSnapshot = subscribeGenerationLogs(
        user.uid,
        (items) => {
          if (!cancelled) {
            setLogs(items);
            setLogsError(null);
          }
        },
        (err) => {
          if (!cancelled) {
            setLogsError(
              err.message.includes('Quota exceeded')
                ? 'Quota giornaliera Firestore raggiunta: riprova domani.'
                : 'Impossibile aggiornare in tempo reale lo storico da Firestore.'
            );
          }
        }
      );
    })();

    return () => {
      cancelled = true;
      unsubscribeSnapshot?.();
    };
  }, [authReady, isAdmin, hasAdminClaim, user, loadLogsFromServer]);

  const handleDeleteLog = async (logId: string) => {
    setDeletingLogId(logId);
    setLogsError(null);
    try {
      if (hasAdminClaim) {
        await deleteGenerationLog(logId);
      } else {
        const freshToken = (await refreshIdToken(false)) ?? idTokenRef.current;
        await deleteAdminTelemetryLogApi(logId, freshToken);
      }
      setLogs((prev) => prev.filter((entry) => entry.id !== logId));
    } catch (err) {
      setLogsError(
        err instanceof Error
          ? err.message
          : 'Impossibile eliminare il log selezionato.'
      );
    } finally {
      setDeletingLogId(null);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (sourceFilter === 'creator') {
        return item.source === 'creator';
      }
      if (sourceFilter === 'prompt_lab_standard') {
        return item.source === 'prompt_lab' && item.executionMode === 'standard';
      }
      if (sourceFilter === 'prompt_lab_batch') {
        return item.source === 'prompt_lab' && item.executionMode === 'batch';
      }
      return true;
    });
  }, [logs, sourceFilter]);

  if (!isAdmin) return null;

  const creatorCount = logs.filter((l) => l.source === 'creator').length;
  const promptLabCount = logs.filter((l) => l.source === 'prompt_lab').length;
  const totalCostUsd = filteredLogs.reduce(
    (acc, item) => acc + item.estimatedCostUsd,
    0
  );
  const avgCostUsd =
    filteredLogs.length > 0 ? totalCostUsd / filteredLogs.length : 0;

  return (
    <div className="space-y-4">
      {latestTelemetry && (
        <section
          aria-label="Telemetria costi ultima generazione singola"
          className="cs-card space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--cs-ink-muted)]">
                Telemetria Live · Ultima generazione App
              </p>
              <h4 className="text-base font-bold text-[var(--cs-ink)]">
                {latestTelemetry.provider} ·{' '}
                <span className="font-mono-num text-sm">
                  {latestTelemetry.model}
                </span>{' '}
                · Prompt{' '}
                <span className="font-mono-num text-sm">
                  {latestTelemetry.promptVersion}
                </span>
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {latestTelemetry.isFreeTier && (
                <UiBadge tone="mint">Free tier</UiBadge>
              )}
              <UiBadge tone="white" className="font-mono-num">
                {latestTelemetry.outputFormat.toUpperCase()} ·{' '}
                {latestTelemetry.latencyMs} ms
              </UiBadge>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)] p-3">
              <p className="text-xs font-bold text-[var(--cs-ink-muted)]">
                Costo pagina
              </p>
              <p className="mt-1 text-lg font-bold font-mono-num text-[var(--cs-ink)]">
                {formatUsd(latestTelemetry.estimatedCostUsd, 5)}
              </p>
            </div>
            <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)] p-3">
              <p className="text-xs font-bold text-[var(--cs-ink-muted)]">
                Stima libro ({ORDER_CONFIG.projectedBookPages} pag.)
              </p>
              <p className="mt-1 text-lg font-bold font-mono-num text-[var(--cs-ink)]">
                {formatUsd(latestTelemetry.projectedBook16CostUsd, 4)}
              </p>
            </div>
            <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)] p-3">
              <p className="text-xs font-bold text-[var(--cs-ink-muted)]">
                Token input (cache)
              </p>
              <p className="mt-1 text-lg font-bold font-mono-num text-[var(--cs-ink)]">
                {latestTelemetry.inputTokens}
                <span className="text-xs font-normal text-[var(--cs-ink-muted)]">
                  {' '}
                  ({latestTelemetry.cachedInputTokens})
                </span>
              </p>
            </div>
            <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)] p-3">
              <p className="text-xs font-bold text-[var(--cs-ink-muted)]">
                Output (testo / img)
              </p>
              <p className="mt-1 text-lg font-bold font-mono-num text-[var(--cs-ink)]">
                {latestTelemetry.textOutputTokens} /{' '}
                {latestTelemetry.imageOutputTokens}
              </p>
            </div>
          </div>
        </section>
      )}

      {latestTelemetry?.model === 'gemini-4-hydrogen' && (
        <TempModelCostEstimatorPanel telemetry={latestTelemetry} />
      )}

      <section
        aria-label="Storico unificato telemetria App e Laboratorio Prompt"
        className="cs-card !p-0 overflow-hidden"
      >
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            aria-expanded={historyOpen}
            className="flex-1 min-w-[220px] flex items-center justify-between gap-4 text-left cursor-pointer"
          >
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-[var(--cs-ink)]">
                Storico Telemetria Admin ({logs.length} generazioni ·{' '}
                {creatorCount} App · {promptLabCount} Laboratorio Prompt)
              </h4>
              <p className="text-xs text-[var(--cs-ink-muted)]">
                Include sia i test singoli dall’app principale sia tutte le immagini elaborate nel Laboratorio Prompt (Standard &amp; Batch -50%).
              </p>
            </div>
            {historyOpen ? (
              <ChevronUp
                className="w-4 h-4 text-[var(--cs-ink)] shrink-0"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="w-4 h-4 text-[var(--cs-ink)] shrink-0"
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            disabled={isLoadingLogs}
            onClick={() => void loadLogsFromServer()}
            aria-label="Aggiorna log telemetria"
            className="inline-flex items-center gap-1.5 rounded-[8px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)] px-2.5 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Aggiorna</span>
          </button>
        </div>

        {historyOpen && (
          <div className="border-t-[3px] border-[var(--cs-border)] space-y-4 pt-4">
            {logsError && (
              <p className="mx-5 rounded-[8px] border-2 border-[var(--cs-border)] px-3.5 py-2.5 text-xs font-bold text-[var(--cs-danger-ink)] bg-[var(--cs-danger-bg)]">
                {logsError}
              </p>
            )}

            {/* Filter chips + KPI summary */}
            <div className="px-5 space-y-3">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Filtra origine log telemetria"
              >
                {(
                  [
                    ['all', `Tutti (${logs.length})`],
                    ['creator', `App Singola (${creatorCount})`],
                    [
                      'prompt_lab_standard',
                      `Prompt Lab · Standard (${
                        logs.filter(
                          (l) =>
                            l.source === 'prompt_lab' &&
                            l.executionMode === 'standard'
                        ).length
                      })`,
                    ],
                    [
                      'prompt_lab_batch',
                      `Prompt Lab · Batch -50% (${
                        logs.filter(
                          (l) =>
                            l.source === 'prompt_lab' &&
                            l.executionMode === 'batch'
                        ).length
                      })`,
                    ],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSourceFilter(key)}
                    className={`rounded-[8px] border-2 border-[var(--cs-border)] px-2.5 py-1 text-xs font-bold cursor-pointer ${
                      sourceFilter === key
                        ? 'bg-[var(--cs-yellow)]'
                        : 'bg-white hover:bg-[var(--cs-bg)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)]/60 p-3">
                  <p className="text-[11px] font-bold text-[var(--cs-ink-muted)]">
                    Generazioni filtrate
                  </p>
                  <p className="mt-0.5 text-base font-bold font-mono-num text-[var(--cs-ink)]">
                    {filteredLogs.length}
                  </p>
                </div>
                <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)]/60 p-3">
                  <p className="text-[11px] font-bold text-[var(--cs-ink-muted)]">
                    Spesa totale vista
                  </p>
                  <p className="mt-0.5 text-base font-bold font-mono-num text-[var(--cs-ink)]">
                    {formatUsd(totalCostUsd, 5)}
                  </p>
                </div>
                <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)]/60 p-3">
                  <p className="text-[11px] font-bold text-[var(--cs-ink-muted)]">
                    Media costo / pagina
                  </p>
                  <p className="mt-0.5 text-base font-bold font-mono-num text-[var(--cs-ink)]">
                    {formatUsd(avgCostUsd, 5)}
                  </p>
                </div>
                <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)]/60 p-3">
                  <p className="text-[11px] font-bold text-[var(--cs-ink-muted)]">
                    Proiezione {ORDER_CONFIG.projectedBookPages} pag.
                  </p>
                  <p className="mt-0.5 text-base font-bold font-mono-num text-[var(--cs-ink)]">
                    {formatUsd(avgCostUsd * ORDER_CONFIG.projectedBookPages, 4)}
                  </p>
                </div>
              </div>
            </div>

            {isLoadingLogs && logs.length === 0 ? (
              <UiCard
                tone="surface"
                className="!border-0 !shadow-none px-5 py-6 text-sm font-bold text-[var(--cs-ink)]"
              >
                Caricamento log di telemetria in corso…
              </UiCard>
            ) : filteredLogs.length === 0 ? (
              <UiCard
                tone="surface"
                className="!border-0 !shadow-none px-5 py-6 text-sm text-[var(--cs-ink-muted)]"
              >
                Nessun log presente per questo filtro. Avvia un test dall’app principale o dal Laboratorio Prompt per registrare costi e token.
              </UiCard>
            ) : (
              <div className="overflow-x-auto border-t-2 border-[var(--cs-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--cs-sky)] text-[var(--cs-ink)] border-b-2 border-[var(--cs-border)]">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Data</th>
                      <th className="py-2.5 px-3 font-bold">Origine</th>
                      <th className="py-2.5 px-3 font-bold">Tema</th>
                      <th className="py-2.5 px-3 font-bold">Modello</th>
                      <th className="py-2.5 px-3 font-bold">Prompt</th>
                      <th className="py-2.5 px-3 font-bold">Token (in/out)</th>
                      <th className="py-2.5 px-3 font-bold">Latenza</th>
                      <th className="py-2.5 px-3 font-bold">Costo</th>
                      <th className="py-2.5 px-4 font-bold text-right">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[var(--cs-border)]/20">
                    {filteredLogs.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--cs-bg)]/50">
                        <td className="py-2.5 px-4 font-mono-num text-[var(--cs-ink-muted)] whitespace-nowrap">
                          {formatDateTime(item.createdAtMs)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-0.5">
                            <div>
                              {item.source === 'prompt_lab' ? (
                                <span
                                  className={`inline-block rounded-[6px] border border-[var(--cs-border)] px-1.5 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap ${
                                    item.executionMode === 'batch'
                                      ? 'bg-[var(--cs-mint)]'
                                      : 'bg-[var(--cs-blue)]'
                                  }`}
                                >
                                  {item.executionMode === 'batch'
                                    ? 'Lab · Batch -50%'
                                    : 'Lab · Standard'}
                                </span>
                              ) : (
                                <span className="inline-block rounded-[6px] border border-[var(--cs-border)] bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap">
                                  App Singola
                                </span>
                              )}
                            </div>
                            {item.runTitle || item.inputName ? (
                              <span className="text-[10px] text-[var(--cs-ink-muted)] truncate max-w-[200px]">
                                {[item.runTitle, item.inputName]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[var(--cs-ink)] capitalize whitespace-nowrap">
                          {item.themeId}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-[var(--cs-ink)] whitespace-nowrap">
                          {item.model}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-[var(--cs-ink-muted)] whitespace-nowrap">
                          {item.promptVersion}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-[var(--cs-ink-muted)] whitespace-nowrap">
                          {item.inputTokens} /{' '}
                          {item.textOutputTokens + item.imageOutputTokens}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-[var(--cs-ink-muted)] whitespace-nowrap">
                          {item.latencyMs > 0 ? `${item.latencyMs} ms` : 'Batch'}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num font-bold text-[var(--cs-ink)] whitespace-nowrap">
                          {formatUsd(item.estimatedCostUsd, 5)}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={deletingLogId === item.id}
                            onClick={() => void handleDeleteLog(item.id)}
                            aria-label={`Elimina log del ${formatDateTime(item.createdAtMs)}`}
                            className="inline-flex items-center justify-center p-1.5 rounded-[8px] border-2 border-transparent text-[var(--cs-ink-muted)] hover:text-[var(--cs-danger-ink)] hover:bg-[var(--cs-danger-bg)] hover:border-[var(--cs-border)] transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Trash2
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
