import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useAuth } from '../modules/auth';
import type { AdminTelemetry } from '../modules/coloring-api';
import {
  deleteGenerationLog,
  subscribeGenerationLogs,
  type GenerationLogRecord,
} from '../modules/database';
import { ORDER_CONFIG } from '../config/orderConfig';
import { TempModelCostEstimatorPanel } from './TempModelCostEstimatorPanel';
import { UiBadge, UiButton, UiCard } from './ui';

interface AdminTelemetryPanelProps {
  latestTelemetry: AdminTelemetry | null;
}

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
  const { user, authReady, isAdmin, hasAdminClaim, refreshAdminSession } =
    useAuth();
  const [logs, setLogs] = useState<GenerationLogRecord[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!authReady || !isAdmin || !hasAdminClaim || !user) {
      setLogs([]);
      setLogsError(null);
      return;
    }

    const unsubscribe = subscribeGenerationLogs(
      user.uid,
      (items) => {
        setLogs(items);
        setLogsError(null);
      },
      (err) => {
        setLogsError(
          err.message.includes('Quota exceeded')
            ? 'Quota giornaliera Firestore raggiunta: riprova domani.'
            : 'Impossibile caricare lo storico generazioni da Firestore.'
        );
      }
    );

    return () => unsubscribe();
  }, [authReady, isAdmin, hasAdminClaim, user]);

  if (!isAdmin) return null;

  const avgCostUsd =
    logs.length > 0
      ? logs.reduce((acc, item) => acc + item.estimatedCostUsd, 0) / logs.length
      : 0;

  return (
    <div className="space-y-4">
      {latestTelemetry && (
        <section
          aria-label="Telemetria costi generazione admin"
          className="cs-card space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--cs-ink-muted)]">
                Telemetria Admin · Singola generazione
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
              <p className="text-xs font-bold text-[var(--cs-ink-muted)]">Costo pagina</p>
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
              <p className="text-xs font-bold text-[var(--cs-ink-muted)]">Token input (cache)</p>
              <p className="mt-1 text-lg font-bold font-mono-num text-[var(--cs-ink)]">
                {latestTelemetry.inputTokens}
                <span className="text-xs font-normal text-[var(--cs-ink-muted)]">
                  {' '}
                  ({latestTelemetry.cachedInputTokens})
                </span>
              </p>
            </div>
            <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)] p-3">
              <p className="text-xs font-bold text-[var(--cs-ink-muted)]">Output (testo / img)</p>
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
        aria-label="Storico generazioni salvate su Firestore"
        className="cs-card !p-0 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => setHistoryOpen((prev) => !prev)}
          aria-expanded={historyOpen}
          className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[var(--cs-bg)]/50 transition-colors cursor-pointer"
        >
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-[var(--cs-ink)]">
              Storico test Admin su Firestore ({logs.length})
            </h4>
            <p className="text-xs text-[var(--cs-ink-muted)]">
              {!hasAdminClaim ? (
                'Storico Firestore disattivato in questa sessione (richiede custom claim Firebase { admin: true }). Telemetria live e controlli Admin attivi.'
              ) : logs.length > 0 ? (
                <>
                  Media costo/pagina:{' '}
                  <span className="font-mono-num font-bold text-[var(--cs-ink)]">
                    {formatUsd(avgCostUsd, 5)}
                  </span>{' '}
                  · Proiezione {ORDER_CONFIG.projectedBookPages} pagine:{' '}
                  <span className="font-mono-num font-bold text-[var(--cs-ink)]">
                    {formatUsd(avgCostUsd * ORDER_CONFIG.projectedBookPages, 4)}
                  </span>
                </>
              ) : (
                'Le generazioni avviate da Admin vengono registrate qui automaticamente.'
              )}
            </p>
          </div>
          {historyOpen ? (
            <ChevronUp className="w-4 h-4 text-[var(--cs-ink)] shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--cs-ink)] shrink-0" aria-hidden="true" />
          )}
        </button>

        {historyOpen && (
          <div className="border-t-[3px] border-[var(--cs-border)]">
            {logsError && (
              <p className="px-5 py-3 text-xs font-bold text-[var(--cs-danger-ink)] bg-[var(--cs-danger-bg)]">
                {logsError}
              </p>
            )}

            {!hasAdminClaim ? (
              <div className="px-5 py-5 text-sm text-[var(--cs-ink)] space-y-2">
                <p>
                  Sei autenticato come Admin tramite{' '}
                  <code className="font-mono-num text-xs bg-[var(--cs-yellow)] border border-[var(--cs-border)] px-1.5 py-0.5 rounded">
                    ADMIN_EMAILS
                  </code>
                  : i controlli prompt/provider e la telemetria della singola generazione qui sopra funzionano normalmente.
                </p>
                <p className="text-xs text-[var(--cs-ink-muted)]">
                  Per sicurezza, le regole di Firestore richiedono il custom claim firmato{' '}
                  <code className="font-mono-num bg-[var(--cs-bg)] border border-[var(--cs-border)] px-1.5 py-0.5 rounded">
                    {'{ admin: true }'}
                  </code>{' '}
                  per leggere o salvare lo storico persistente su{' '}
                  <code className="font-mono-num bg-[var(--cs-bg)] border border-[var(--cs-border)] px-1.5 py-0.5 rounded">
                    generation_logs
                  </code>
                  . Per abilitarlo esegui{' '}
                  <code className="font-mono-num bg-[var(--cs-bg)] border border-[var(--cs-border)] px-1.5 py-0.5 rounded">
                    npx tsx scripts/set-admin-claim.ts {user?.email ?? '<email>'}
                  </code>{' '}
                  e poi effettua di nuovo l’accesso.
                </p>
                <div className="pt-2">
                  <UiButton
                    size="compact"
                    onClick={() => void refreshAdminSession()}
                  >
                    Verifica claim adesso
                  </UiButton>
                </div>
              </div>
            ) : logs.length === 0 ? (
              <UiCard tone="surface" className="!border-0 !shadow-none px-5 py-6 text-sm text-[var(--cs-ink-muted)]">
                Nessun log salvato al momento. Avvia una generazione per registrare costi e token.
              </UiCard>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--cs-sky)] text-[var(--cs-ink)] border-b-2 border-[var(--cs-border)]">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Data</th>
                      <th className="py-2.5 px-3 font-bold">Tema</th>
                      <th className="py-2.5 px-3 font-bold">Modello</th>
                      <th className="py-2.5 px-3 font-bold">Prompt</th>
                      <th className="py-2.5 px-3 font-bold">Token (in/out)</th>
                      <th className="py-2.5 px-3 font-bold">Latenza</th>
                      <th className="py-2.5 px-3 font-bold">Costo</th>
                      <th className="py-2.5 px-4 font-bold text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[var(--cs-border)]/20">
                    {logs.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--cs-bg)]/50">
                        <td className="py-2.5 px-4 font-mono-num text-[var(--cs-ink-muted)] whitespace-nowrap">
                          {formatDateTime(item.createdAtMs)}
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
                          {item.latencyMs} ms
                        </td>
                        <td className="py-2.5 px-3 font-mono-num font-bold text-[var(--cs-ink)] whitespace-nowrap">
                          {formatUsd(item.estimatedCostUsd, 5)}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => void deleteGenerationLog(item.id)}
                            aria-label={`Elimina log del ${formatDateTime(item.createdAtMs)}`}
                            className="inline-flex items-center justify-center p-1.5 rounded-[8px] border-2 border-transparent text-[var(--cs-ink-muted)] hover:text-[var(--cs-danger-ink)] hover:bg-[var(--cs-danger-bg)] hover:border-[var(--cs-border)] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
