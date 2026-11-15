import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AdminTelemetry } from '../services/coloringApi';
import {
  deleteGenerationLog,
  subscribeGenerationLogs,
  type GenerationLogRecord,
} from '../services/firestoreLogs';
import { TempModelCostEstimatorPanel } from './TempModelCostEstimatorPanel';

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
  const { user, authReady, isAdmin } = useAuth();
  const [logs, setLogs] = useState<GenerationLogRecord[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!authReady || !isAdmin || !user) {
      setLogs([]);
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
  }, [authReady, isAdmin, user]);

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
          className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Telemetria Admin · Singola generazione
              </p>
              <h4 className="text-base font-semibold text-zinc-900">
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
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
                  Free tier
                </span>
              )}
              <span className="px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-xs font-mono-num text-zinc-700">
                {latestTelemetry.outputFormat.toUpperCase()} ·{' '}
                {latestTelemetry.latencyMs} ms
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="rounded-xl border border-zinc-200 bg-[#FBFBF9] p-3">
              <p className="text-xs text-zinc-500">Costo pagina</p>
              <p className="mt-1 text-lg font-semibold font-mono-num text-zinc-900">
                {formatUsd(latestTelemetry.estimatedCostUsd, 5)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-[#FBFBF9] p-3">
              <p className="text-xs text-zinc-500">Stima libro (16 pag.)</p>
              <p className="mt-1 text-lg font-semibold font-mono-num text-zinc-900">
                {formatUsd(latestTelemetry.projectedBook16CostUsd, 4)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-[#FBFBF9] p-3">
              <p className="text-xs text-zinc-500">Token input (cache)</p>
              <p className="mt-1 text-lg font-semibold font-mono-num text-zinc-900">
                {latestTelemetry.inputTokens}
                <span className="text-xs font-normal text-zinc-500">
                  {' '}
                  ({latestTelemetry.cachedInputTokens})
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-[#FBFBF9] p-3">
              <p className="text-xs text-zinc-500">Output (testo / img)</p>
              <p className="mt-1 text-lg font-semibold font-mono-num text-zinc-900">
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
        className="rounded-2xl border border-zinc-200 bg-white overflow-hidden"
      >
        <button
          type="button"
          onClick={() => setHistoryOpen((prev) => !prev)}
          aria-expanded={historyOpen}
          className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#FBFBF9] transition-colors cursor-pointer"
        >
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold text-zinc-900">
              Storico test Admin su Firestore ({logs.length})
            </h4>
            <p className="text-xs text-zinc-600">
              {logs.length > 0 ? (
                <>
                  Media costo/pagina:{' '}
                  <span className="font-mono-num font-medium text-zinc-900">
                    {formatUsd(avgCostUsd, 5)}
                  </span>{' '}
                  · Proiezione 16 pagine:{' '}
                  <span className="font-mono-num font-medium text-zinc-900">
                    {formatUsd(avgCostUsd * 16, 4)}
                  </span>
                </>
              ) : (
                'Le generazioni avviate da Admin vengono registrate qui automaticamente.'
              )}
            </p>
          </div>
          {historyOpen ? (
            <ChevronUp className="w-4 h-4 text-zinc-600 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" aria-hidden="true" />
          )}
        </button>

        {historyOpen && (
          <div className="border-t border-zinc-200">
            {logsError && (
              <p className="px-5 py-3 text-xs text-red-700 bg-red-50">
                {logsError}
              </p>
            )}

            {logs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-600">
                Nessun log salvato al momento. Avvia una generazione per registrare costi e token.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FBFBF9] text-zinc-600 border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Data</th>
                      <th className="py-2.5 px-3 font-medium">Tema</th>
                      <th className="py-2.5 px-3 font-medium">Modello</th>
                      <th className="py-2.5 px-3 font-medium">Prompt</th>
                      <th className="py-2.5 px-3 font-medium">Token (in/out)</th>
                      <th className="py-2.5 px-3 font-medium">Latenza</th>
                      <th className="py-2.5 px-3 font-medium">Costo</th>
                      <th className="py-2.5 px-4 font-medium text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {logs.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FBFBF9]/70">
                        <td className="py-2.5 px-4 font-mono-num text-zinc-600 whitespace-nowrap">
                          {formatDateTime(item.createdAtMs)}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-900 capitalize whitespace-nowrap">
                          {item.themeId}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-zinc-800 whitespace-nowrap">
                          {item.model}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-zinc-700 whitespace-nowrap">
                          {item.promptVersion}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-zinc-700 whitespace-nowrap">
                          {item.inputTokens} /{' '}
                          {item.textOutputTokens + item.imageOutputTokens}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-zinc-700 whitespace-nowrap">
                          {item.latencyMs} ms
                        </td>
                        <td className="py-2.5 px-3 font-mono-num font-medium text-zinc-900 whitespace-nowrap">
                          {formatUsd(item.estimatedCostUsd, 5)}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => void deleteGenerationLog(item.id)}
                            aria-label={`Elimina log del ${formatDateTime(item.createdAtMs)}`}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-zinc-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
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
