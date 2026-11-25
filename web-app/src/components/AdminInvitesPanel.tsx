import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../modules/auth';
import {
  createAdminInviteApi,
  deleteAdminInviteApi,
  listAdminInvitesApi,
  updateAdminInviteApi,
  type BetaInviteSummary,
} from '../modules/beta-access';
import { UiBadge, UiButton, UiCard } from './ui';

function formatShortDate(ms: number | null): string {
  if (!ms) return 'Nessuna scadenza';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(ms));
}

function getInviteStatus(invite: BetaInviteSummary): {
  label: string;
  tone: 'mint' | 'yellow' | 'pink' | 'white';
} {
  if (!invite.active) return { label: 'Disattivato', tone: 'white' };
  if (invite.isExpired) return { label: 'Scaduto', tone: 'pink' };
  if (invite.isExhausted) return { label: 'Esaurito', tone: 'yellow' };
  return { label: 'Attivo', tone: 'mint' };
}

export function AdminInvitesPanel() {
  const { authReady, isAdmin, idToken, refreshIdToken } = useAuth();
  const [invites, setInvites] = useState<BetaInviteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [labelInput, setLabelInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [maxInput, setMaxInput] = useState('5');
  const [daysInput, setDaysInput] = useState('7');
  const [isCreating, setIsCreating] = useState(false);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const getFreshToken = useCallback(async (): Promise<string | null> => {
    return (await refreshIdToken()) ?? idToken;
  }, [refreshIdToken, idToken]);

  const loadInvites = useCallback(async () => {
    if (!authReady || !isAdmin) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const token = await getFreshToken();
      const items = await listAdminInvitesApi(token);
      setInvites(items);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Impossibile caricare la lista degli inviti.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [authReady, isAdmin, getFreshToken]);

  useEffect(() => {
    if (authReady && isAdmin) {
      void loadInvites();
    } else {
      setInvites([]);
    }
  }, [authReady, isAdmin, loadInvites]);

  if (!isAdmin) return null;

  const buildInviteLink = (code: string) =>
    `${window.location.origin}/?invite=${encodeURIComponent(code)}`;

  const handleCopyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildInviteLink(code));
      setCopiedCode(code);
      window.setTimeout(() => {
        setCopiedCode((current) => (current === code ? null : current));
      }, 2000);
    } catch {
      setStatusMsg(`Link invito: ${buildInviteLink(code)}`);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (isCreating) return;

    const maxGenerations = Math.trunc(Number(maxInput));
    const trimmedDays = daysInput.trim();
    const expiresInDays = trimmedDays === '' ? null : Number(trimmedDays);

    setIsCreating(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const token = await getFreshToken();
      const created = await createAdminInviteApi(
        {
          label: labelInput,
          code: codeInput.trim() || undefined,
          maxGenerations,
          expiresInDays,
        },
        token
      );
      setInvites((prev) => [created, ...prev]);
      setLabelInput('');
      setCodeInput('');
      setStatusMsg(
        `Invito ${created.code} creato (${created.maxGenerations} generazioni). Link pronto da copiare!`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Errore nella creazione invito.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (invite: BetaInviteSummary) => {
    setBusyCode(invite.code);
    setErrorMsg(null);
    try {
      const token = await getFreshToken();
      const updated = await updateAdminInviteApi(
        invite.code,
        { active: !invite.active },
        token
      );
      setInvites((prev) =>
        prev.map((item) => (item.code === updated.code ? updated : item))
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Impossibile aggiornare invito.'
      );
    } finally {
      setBusyCode(null);
    }
  };

  const handleAddQuota = async (invite: BetaInviteSummary, delta: number) => {
    setBusyCode(invite.code);
    setErrorMsg(null);
    try {
      const token = await getFreshToken();
      const updated = await updateAdminInviteApi(
        invite.code,
        { maxGenerations: invite.maxGenerations + delta },
        token
      );
      setInvites((prev) =>
        prev.map((item) => (item.code === updated.code ? updated : item))
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Impossibile aggiornare la quota.'
      );
    } finally {
      setBusyCode(null);
    }
  };

  const handleDelete = async (invite: BetaInviteSummary) => {
    setBusyCode(invite.code);
    setErrorMsg(null);
    try {
      const token = await getFreshToken();
      await deleteAdminInviteApi(invite.code, token);
      setInvites((prev) => prev.filter((item) => item.code !== invite.code));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Impossibile eliminare invito.'
      );
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <section aria-label="Gestione inviti beta Admin" className="cs-card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--cs-ink-muted)]">
            Accesso Beta · Controllo per utente
          </p>
          <h3 className="text-lg font-bold text-[var(--cs-ink)]">
            Inviti personali ({invites.length})
          </h3>
        </div>
        <UiButton
          variant="secondary"
          size="compact"
          disabled={isLoading}
          onClick={() => void loadInvites()}
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>Aggiorna</span>
        </UiButton>
      </div>

      <form
        onSubmit={(event) => void handleCreate(event)}
        className="rounded-[12px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)] p-4 space-y-3"
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-xs font-bold">Nome tester *</span>
            <input
              type="text"
              required
              maxLength={60}
              placeholder="es. Luca"
              value={labelInput}
              onChange={(event) => setLabelInput(event.target.value)}
              className="w-full rounded-[8px] border-2 border-[var(--cs-border)] bg-white px-2.5 py-2 text-sm font-bold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold">Codice (opzionale)</span>
            <input
              type="text"
              maxLength={32}
              placeholder="Auto (es. BETA-7F2A)"
              value={codeInput}
              onChange={(event) =>
                setCodeInput(event.target.value.toUpperCase())
              }
              className="w-full rounded-[8px] border-2 border-[var(--cs-border)] bg-white px-2.5 py-2 text-sm font-mono-num uppercase"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold">Max generazioni</span>
            <input
              type="number"
              min={1}
              max={1000}
              required
              value={maxInput}
              onChange={(event) => setMaxInput(event.target.value)}
              className="w-full rounded-[8px] border-2 border-[var(--cs-border)] bg-white px-2.5 py-2 text-sm font-mono-num font-bold"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold">Giorni validità</span>
            <input
              type="number"
              min={1}
              max={365}
              placeholder="Nessuna"
              value={daysInput}
              onChange={(event) => setDaysInput(event.target.value)}
              className="w-full rounded-[8px] border-2 border-[var(--cs-border)] bg-white px-2.5 py-2 text-sm font-mono-num font-bold"
            />
          </label>
        </div>

        <UiButton
          type="submit"
          size="compact"
          disabled={isCreating || !labelInput.trim()}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{isCreating ? 'Creazione…' : 'Crea invito'}</span>
        </UiButton>
      </form>

      {errorMsg ? (
        <UiCard tone="danger" className="!p-3 text-sm font-bold" role="alert">
          {errorMsg}
        </UiCard>
      ) : null}

      {statusMsg ? (
        <UiCard tone="mint" className="!p-3 text-sm font-bold" role="status">
          {statusMsg}
        </UiCard>
      ) : null}

      {invites.length === 0 ? (
        <p className="text-sm text-[var(--cs-ink-muted)]">
          Nessun invito creato al momento.
        </p>
      ) : (
        <div className="space-y-2.5">
          {invites.map((invite, idx) => {
            const status = getInviteStatus(invite);
            const isBusy = busyCode === invite.code;
            const isCopied = copiedCode === invite.code;

            return (
              <div
                key={invite.code}
                className={`flex flex-col gap-3 rounded-[12px] border-2 border-[var(--cs-border)] bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between ${
                  idx >= 6 ? 'cs-deferred-card' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[var(--cs-ink)]">
                      {invite.label}
                    </span>
                    <code className="rounded-[6px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)] px-2 py-0.5 text-xs font-mono-num font-bold">
                      {invite.code}
                    </code>
                    <UiBadge tone={status.tone}>{status.label}</UiBadge>
                  </div>
                  <p className="text-xs text-[var(--cs-ink-muted)] font-mono-num">
                    Usate: {invite.usedGenerations}/{invite.maxGenerations} ·
                    Scadenza: {formatShortDate(invite.expiresAtMs)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyLink(invite.code)}
                    className="inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border)] bg-[var(--cs-yellow)] px-2.5 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copiato</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copia link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleAddQuota(invite, 5)}
                    className="rounded-[8px] border-2 border-[var(--cs-border)] bg-[var(--cs-sky)] px-2.5 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    +5
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleToggleActive(invite)}
                    className="rounded-[8px] border-2 border-[var(--cs-border)] bg-white px-2.5 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {invite.active ? 'Disattiva' : 'Riattiva'}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDelete(invite)}
                    aria-label={`Elimina invito ${invite.code}`}
                    className="inline-flex items-center justify-center rounded-[8px] border-2 border-[var(--cs-border)] bg-[var(--cs-danger-bg)] p-1.5 text-[var(--cs-danger-ink)] cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
