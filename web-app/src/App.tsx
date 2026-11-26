import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  ADMIN_BASE_PATH,
  buildAdminUrl,
  isAdminPath,
  parseAdminRunIdFromSearch,
  parseAdminTabFromSearch,
  type AdminServiceTab,
} from './config/adminRoutes';
import { DESIGN_V2_PATH, isDesignV2Path } from './config/designRoutes';
import { CreatorDialog } from './components/CreatorDialog';
import {
  LEGAL_ROUTES,
  parseLegalSlugFromPathname,
  type LegalRouteSlug,
} from './config/legalRoutes';

const AdminPage = lazy(() =>
  import('./components/AdminPage').then((m) => ({ default: m.AdminPage }))
);
const LegalPage = lazy(() =>
  import('./components/LegalPage').then((m) => ({ default: m.LegalPage }))
);
const HomeV2 = lazy(() =>
  import('./components/v2').then((m) => ({ default: m.HomeV2 }))
);
const CreatorDialogV2 = lazy(() =>
  import('./components/v2').then((m) => ({ default: m.CreatorDialogV2 }))
);
import {
  BottomCtaSection,
  CategoriesSection,
  HeroSection,
  HowItWorksSection,
  Navbar,
  SiteFooter,
} from './components/sections';
import { UiCard } from './components/ui';
import { useAuth } from './modules/auth';
import {
  fetchAccessSessionApi,
  redeemInviteApi,
  type AccessSessionResponse,
  type BetaInviteQuota,
} from './modules/beta-access';
import type { AdminTelemetry } from './modules/coloring-api';

const HOME_TITLE = 'ColoraStoria — da foto a pagina da colorare';

interface InviteBanner {
  tone: 'mint' | 'danger';
  text: string;
}

interface RouteState {
  kind: 'home' | 'home-v2' | 'legal' | 'admin';
  legalSlug: LegalRouteSlug | null;
  adminTab: AdminServiceTab;
  adminRunId: string | null;
}

function readCurrentRoute(): RouteState {
  if (typeof window === 'undefined') {
    return {
      kind: 'home',
      legalSlug: null,
      adminTab: 'prompt-lab',
      adminRunId: null,
    };
  }
  const { pathname, search } = window.location;
  if (isAdminPath(pathname)) {
    return {
      kind: 'admin',
      legalSlug: null,
      adminTab: parseAdminTabFromSearch(search),
      adminRunId: parseAdminRunIdFromSearch(search),
    };
  }
  if (isDesignV2Path(pathname)) {
    return {
      kind: 'home-v2',
      legalSlug: null,
      adminTab: 'prompt-lab',
      adminRunId: null,
    };
  }
  const legalSlug = parseLegalSlugFromPathname(pathname);
  if (legalSlug) {
    return {
      kind: 'legal',
      legalSlug,
      adminTab: 'prompt-lab',
      adminRunId: null,
    };
  }
  return {
    kind: 'home',
    legalSlug: null,
    adminTab: 'prompt-lab',
    adminRunId: null,
  };
}

export default function App() {
  const {
    user,
    authReady,
    isAdmin,
    idToken,
    authNotice,
    signOutUser,
    clearAuthNotice,
  } = useAuth();

  const [route, setRoute] = useState<RouteState>(() => readCurrentRoute());
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [latestTelemetry, setLatestTelemetry] = useState<AdminTelemetry | null>(
    null
  );
  const [accessSession, setAccessSession] =
    useState<AccessSessionResponse | null>(null);
  const [inviteBanner, setInviteBanner] = useState<InviteBanner | null>(null);

  const sessionMutationSeqRef = useRef(0);
  const initialInviteHandledRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      setRoute(readCurrentRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (route.kind === 'admin') {
      document.title = 'Console Admin — ColoraStoria';
    } else if (route.kind === 'legal' && route.legalSlug) {
      document.title = `${LEGAL_ROUTES[route.legalSlug].title} — ColoraStoria`;
    } else {
      document.title = HOME_TITLE;
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const targetPath =
        route.kind === 'admin'
          ? ADMIN_BASE_PATH
          : route.kind === 'home-v2'
            ? DESIGN_V2_PATH
            : route.kind === 'legal' && route.legalSlug
              ? LEGAL_ROUTES[route.legalSlug].path
              : '/';
      canonical.setAttribute('href', `${window.location.origin}${targetPath}`);
    }
  }, [route]);

  useEffect(() => {
    if (!authReady) return;

    const seq = ++sessionMutationSeqRef.current;
    void fetchAccessSessionApi(idToken).then((session) => {
      if (sessionMutationSeqRef.current === seq) {
        setAccessSession(session);
      }
    });
  }, [authReady, isAdmin, idToken]);

  useEffect(() => {
    if (initialInviteHandledRef.current) return;
    initialInviteHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('invite')?.trim();
    if (!inviteCode) return;

    params.delete('invite');
    const remainingSearch = params.toString();
    const cleanUrl = `${window.location.pathname}${remainingSearch ? `?${remainingSearch}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', cleanUrl);

    void redeemInviteApi(inviteCode)
      .then((session) => {
        sessionMutationSeqRef.current += 1;
        setAccessSession(session);
        setCreatorOpen(true);
        if (session.invite) {
          setInviteBanner({
            tone: 'mint',
            text: `Invito «${session.invite.label}» attivo: ${session.invite.remainingGenerations} su ${session.invite.maxGenerations} generazioni disponibili.`,
          });
        }
      })
      .catch((err) => {
        setCreatorOpen(true);
        setInviteBanner({
          tone: 'danger',
          text:
            err instanceof Error
              ? err.message
              : 'Codice invito non valido o scaduto.',
        });
      });
  }, []);

  const navigateToPath = useCallback((url: string, replace = false) => {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== url) {
      if (replace) {
        window.history.replaceState(null, '', url);
      } else {
        window.history.pushState(null, '', url);
      }
    }
    setRoute(readCurrentRoute());
    if (!replace) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const navigateToAdmin = useCallback(
    (tab: AdminServiceTab = 'prompt-lab', runId?: string | null) => {
      navigateToPath(buildAdminUrl(tab, runId));
    },
    [navigateToPath]
  );

  const handleAdminRunSelected = useCallback(
    (runId: string | null) => {
      navigateToPath(buildAdminUrl('prompt-lab', runId), true);
    },
    [navigateToPath]
  );

  const openCreator = () => {
    setCreatorOpen(true);
  };

  const handleAccessSessionChange = (nextSession: AccessSessionResponse) => {
    sessionMutationSeqRef.current += 1;
    setAccessSession(nextSession);
    setInviteBanner(null);
  };

  const handleInviteQuotaUpdate = (nextQuota: BetaInviteQuota) => {
    sessionMutationSeqRef.current += 1;
    setAccessSession((prev) => ({
      inviteRequired: prev?.inviteRequired ?? true,
      hasAccess: nextQuota.remainingGenerations > 0,
      accessSource: nextQuota.remainingGenerations > 0 ? 'invite' : 'none',
      invite: nextQuota,
    }));
  };

  const isDesignV2 = route.kind === 'home-v2';

  return (
    <div
      className={`min-h-screen flex flex-col bg-[var(--cs-bg)] text-[var(--cs-ink)]${
        isDesignV2 ? ' cs-v2-scope' : ''
      }`}
    >
      <Navbar
        isAdmin={isAdmin}
        userEmail={user?.email ?? null}
        isOnAdminPage={route.kind === 'admin'}
        isDesignV2={isDesignV2}
        onLogoClick={() => navigateToPath(isDesignV2 ? DESIGN_V2_PATH : '/')}
        onStartClick={openCreator}
        onToggleDesignVersion={() =>
          navigateToPath(isDesignV2 ? '/' : DESIGN_V2_PATH)
        }
        onNavigateAdmin={(tab) => navigateToAdmin(tab ?? 'prompt-lab')}
        onNavigateLegal={(slug) => navigateToPath(LEGAL_ROUTES[slug].path)}
        onSignOut={() => void signOutUser()}
      />

      {inviteBanner ? (
        <div className="cs-wrap pt-2" role="status">
          <UiCard
            tone={inviteBanner.tone}
            className="flex items-center justify-between gap-3 !py-2.5 !px-3.5 text-sm font-bold"
          >
            <span>{inviteBanner.text}</span>
            <button
              type="button"
              onClick={() => setInviteBanner(null)}
              aria-label="Chiudi avviso invito"
              className="rounded-[8px] border-2 border-[var(--cs-border)] bg-white p-1 hover:bg-[var(--cs-bg)] cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </UiCard>
        </div>
      ) : null}

      {authNotice ? (
        <div className="cs-wrap pt-2" role="status">
          <UiCard
            tone="yellow"
            className="flex items-center justify-between gap-3 !py-2.5 !px-3.5 text-sm font-bold"
          >
            <span>{authNotice}</span>
            <button
              type="button"
              onClick={clearAuthNotice}
              aria-label="Chiudi avviso"
              className="rounded-[8px] border-2 border-[var(--cs-border)] bg-white p-1 hover:bg-[var(--cs-bg)] cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </UiCard>
        </div>
      ) : null}

      <main className="flex-1">
        {route.kind === 'admin' ? (
          <Suspense
            fallback={
              <div className="cs-wrap py-12">
                <UiCard className="p-6 text-center text-sm font-bold">
                  Caricamento…
                </UiCard>
              </div>
            }
          >
            <AdminPage
              activeTab={route.adminTab}
              selectedRunId={route.adminRunId}
              latestTelemetry={latestTelemetry}
              onSelectTab={(tab) => navigateToAdmin(tab)}
              onSelectRunId={handleAdminRunSelected}
              onNavigateHome={() => navigateToPath('/')}
            />
          </Suspense>
        ) : route.kind === 'legal' && route.legalSlug ? (
          <Suspense
            fallback={
              <div className="cs-wrap py-12">
                <UiCard className="p-6 text-center text-sm font-bold">
                  Caricamento…
                </UiCard>
              </div>
            }
          >
            <LegalPage
              slug={route.legalSlug}
              onNavigateHome={() => navigateToPath('/')}
              onNavigateLegal={(slug) => navigateToPath(LEGAL_ROUTES[slug].path)}
            />
          </Suspense>
        ) : route.kind === 'home-v2' ? (
          <Suspense
            fallback={
              <div className="cs-wrap py-12">
                <UiCard className="p-6 text-center text-sm font-bold">
                  Caricamento…
                </UiCard>
              </div>
            }
          >
            <HomeV2
              isAdmin={isAdmin}
              accessSession={accessSession}
              creatorOpen={creatorOpen}
              onStartClick={openCreator}
              onSwitchToV1={() => navigateToPath('/')}
            />
          </Suspense>
        ) : (
          <>
            <HeroSection onStartClick={openCreator} />
            <CategoriesSection />
            <HowItWorksSection />
            <BottomCtaSection onStartClick={openCreator} />
          </>
        )}
      </main>

      <SiteFooter
        isAdmin={isAdmin}
        userEmail={user?.email ?? null}
        onNavigateHome={() => navigateToPath(isDesignV2 ? DESIGN_V2_PATH : '/')}
        onNavigateLegal={(slug) => navigateToPath(LEGAL_ROUTES[slug].path)}
        onNavigateAdmin={() => navigateToAdmin('prompt-lab')}
        onSignOut={() => void signOutUser()}
      />

      {isDesignV2 ? (
        <Suspense fallback={null}>
          <CreatorDialogV2
            open={creatorOpen}
            onClose={() => setCreatorOpen(false)}
            accessSession={accessSession}
            onAccessSessionChange={handleAccessSessionChange}
            onInviteQuotaUpdate={handleInviteQuotaUpdate}
            onTelemetryGenerated={setLatestTelemetry}
          />
        </Suspense>
      ) : (
        <CreatorDialog
          open={creatorOpen}
          onClose={() => setCreatorOpen(false)}
          accessSession={accessSession}
          onAccessSessionChange={handleAccessSessionChange}
          onInviteQuotaUpdate={handleInviteQuotaUpdate}
          onTelemetryGenerated={setLatestTelemetry}
        />
      )}
    </div>
  );
}
