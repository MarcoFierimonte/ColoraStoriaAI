import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  BarChart3,
  FlaskConical,
  LogIn,
  LogOut,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import {
  ADMIN_BASE_PATH,
  ADMIN_TABS,
  buildAdminUrl,
  isAdminPath,
  parseAdminRunIdFromSearch,
  parseAdminTabFromSearch,
  type AdminServiceTab,
} from '../config/adminRoutes';
import { SITE_TEMPLATE } from '../config/siteTemplate';
import { useAuth } from '../modules/auth';
import type { AdminTelemetry } from '../modules/coloring-api';
import {
  promptEvalApiClient,
  PromptEvalWorkbench,
  type PromptEvalQuickSampleOption,
} from '../modules/prompt-eval';
import { AdminInvitesPanel } from './AdminInvitesPanel';
import { AdminTelemetryPanel } from './AdminTelemetryPanel';
import { UiBadge, UiButton, UiCard } from './ui';

export {
  ADMIN_BASE_PATH,
  ADMIN_TABS,
  buildAdminUrl,
  isAdminPath,
  parseAdminRunIdFromSearch,
  parseAdminTabFromSearch,
  type AdminServiceTab,
};

export interface AdminPageProps {
  activeTab: AdminServiceTab;
  selectedRunId: string | null;
  latestTelemetry: AdminTelemetry | null;
  onSelectTab: (tab: AdminServiceTab) => void;
  onSelectRunId: (runId: string | null) => void;
  onNavigateHome: () => void;
}

export function AdminPage({
  activeTab,
  selectedRunId,
  latestTelemetry,
  onSelectTab,
  onSelectRunId,
  onNavigateHome,
}: AdminPageProps) {
  const {
    user,
    authReady,
    isAdmin,
    hasAdminClaim,
    idToken,
    isSigningIn,
    signInWithGoogle,
    signOutUser,
    refreshIdToken,
  } = useAuth();

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const idTokenRef = useRef<string | null>(idToken);

  useEffect(() => {
    idTokenRef.current = idToken;
  }, [idToken]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const getFreshToken = useCallback(async (): Promise<string | null> => {
    return (await refreshIdToken(false)) ?? idTokenRef.current;
  }, [refreshIdToken]);

  const quickSamples = useMemo<PromptEvalQuickSampleOption[]>(() => {
    const items = SITE_TEMPLATE.examplesGallery.items.filter(
      (item) => Boolean(item.photoSrc)
    );
    if (items.length === 0) return [];
    return [
      {
        id: 'real-gallery-6',
        label: `Carica ${items.length} foto esempio app`,
        loadFiles: async () => {
          const loaded: File[] = [];
          for (const item of items) {
            if (!item.photoSrc) continue;
            const resp = await fetch(item.photoSrc);
            if (!resp.ok) {
              throw new Error(
                `Impossibile caricare la foto di esempio "${item.id}" (HTTP ${resp.status}).`
              );
            }
            const blob = await resp.blob();
            loaded.push(
              new File([blob], `${item.id}-photo.jpg`, {
                type: blob.type || 'image/jpeg',
              })
            );
          }
          return loaded;
        },
      },
    ];
  }, []);

  if (!authReady) {
    return (
      <section className="py-12" aria-label="Verifica accesso Admin">
        <div className="cs-wrap max-w-2xl">
          <UiCard className="p-6 text-center space-y-2">
            <p className="text-sm font-bold">
              Verifica sessione amministratore in corso…
            </p>
          </UiCard>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section
        className="py-12"
        aria-labelledby="admin-restricted-heading"
      >
        <div className="cs-wrap max-w-xl space-y-5">
          <div>
            <button
              type="button"
              onClick={onNavigateHome}
              className="cs-btn cs-btn-secondary cs-btn-compact inline-flex"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Torna all’app principale</span>
            </button>
          </div>

          <UiCard className="p-6 sm:p-8 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-yellow)] px-3 py-1 text-xs font-bold">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Area Riservata · Solo Amministratori</span>
            </div>

            <div className="space-y-2">
              <h1
                id="admin-restricted-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[var(--cs-ink)] focus:outline-none"
              >
                Console Admin ColoraStoria
              </h1>
              <p className="text-sm text-[var(--cs-ink-muted)] leading-relaxed">
                Questa pagina ospita il Laboratorio Prompt &amp; Batch API, la gestione degli inviti beta e la telemetria costi. Accedi con un account Google autorizzato.
              </p>
            </div>

            {user?.email ? (
              <UiCard tone="danger" className="!p-3 text-xs font-bold space-y-2">
                <p>
                  L’account connesso ({user.email}) non dispone dei privilegi amministratore.
                </p>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="underline decoration-2 cursor-pointer"
                >
                  Disconnetti e cambia account
                </button>
              </UiCard>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <UiButton
                variant="mint"
                size="compact"
                disabled={isSigningIn}
                onClick={() => void signInWithGoogle()}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isSigningIn ? 'Accesso in corso…' : 'Accedi con Google (Admin)'}
                </span>
              </UiButton>
            </div>
          </UiCard>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="admin-console-title"
      className="py-6 sm:py-8"
    >
      <div className="mx-auto max-w-[1220px] px-4 space-y-6">
        {/* Admin Console Header */}
        <div className="cs-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <UiBadge tone="mint">Console Admin</UiBadge>
              {user?.email ? (
                <UiBadge tone="white" className="font-mono-num">
                  {user.email}
                </UiBadge>
              ) : null}
              <UiBadge tone={hasAdminClaim ? 'blue' : 'yellow'}>
                {hasAdminClaim ? 'Claim Firebase attivo' : 'Modalità ADMIN_EMAILS'}
              </UiBadge>
            </div>
            <h1
              id="admin-console-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[var(--cs-ink)] focus:outline-none"
            >
              Strumenti Amministratore
            </h1>
            <p className="text-xs sm:text-sm text-[var(--cs-ink-muted)]">
              {ADMIN_TABS.find((t) => t.id === activeTab)?.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <UiButton
              variant="secondary"
              size="compact"
              onClick={onNavigateHome}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>App principale</span>
            </UiButton>
            <UiButton
              variant="yellow"
              size="compact"
              onClick={() => void signOutUser()}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Esci</span>
            </UiButton>
          </div>
        </div>

        {/* Multi-Service Admin Navigation Tabs */}
        <nav
          aria-label="Servizi amministratore"
          role="tablist"
          className="flex flex-wrap gap-2.5"
        >
          {ADMIN_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon =
              tab.id === 'prompt-lab'
                ? FlaskConical
                : tab.id === 'invites'
                  ? Ticket
                  : BarChart3;
            return (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`admin-panel-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-[10px] border-[3px] border-[var(--cs-border)] px-4 py-2.5 text-sm font-bold cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[var(--cs-mint)] shadow-none translate-x-[2px] translate-y-[2px]'
                    : 'bg-white shadow-[4px_4px_0_var(--cs-border)] hover:bg-[var(--cs-yellow)]'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{tab.shortLabel}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Admin Service Panel */}
        <div
          id={`admin-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`admin-tab-${activeTab}`}
        >
          {activeTab === 'prompt-lab' ? (
            <PromptEvalWorkbench
              client={promptEvalApiClient}
              getAuthToken={getFreshToken}
              defaultNotifyEmail={user?.email ?? null}
              initialRunId={selectedRunId}
              onSelectRunId={onSelectRunId}
              quickSamples={quickSamples}
            />
          ) : activeTab === 'invites' ? (
            <AdminInvitesPanel />
          ) : (
            <AdminTelemetryPanel latestTelemetry={latestTelemetry} />
          )}
        </div>
      </div>
    </section>
  );
}
