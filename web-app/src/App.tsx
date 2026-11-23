import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AdminInvitesPanel } from './components/AdminInvitesPanel';
import { AdminTelemetryPanel } from './components/AdminTelemetryPanel';
import { CreatorDialog } from './components/CreatorDialog';
import {
  LEGAL_ROUTES,
  LegalPage,
  parseLegalSlugFromPathname,
  type LegalRouteSlug,
} from './components/LegalPage';
import {
  BottomCtaSection,
  CategoriesSection,
  ExamplesGallerySection,
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

export default function App() {
  const {
    user,
    authReady,
    isAdmin,
    idToken,
    isSigningIn,
    authNotice,
    signInWithGoogle,
    signOutUser,
    clearAuthNotice,
  } = useAuth();

  const [legalSlug, setLegalSlug] = useState<LegalRouteSlug | null>(() =>
    typeof window !== 'undefined'
      ? parseLegalSlugFromPathname(window.location.pathname)
      : null
  );
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
      setLegalSlug(parseLegalSlugFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (legalSlug) {
      document.title = `${LEGAL_ROUTES[legalSlug].title} — ColoraStoria`;
    } else {
      document.title = HOME_TITLE;
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const targetPath = legalSlug ? LEGAL_ROUTES[legalSlug].path : '/';
      canonical.setAttribute('href', `${window.location.origin}${targetPath}`);
    }
  }, [legalSlug]);

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

  const navigateToPath = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    setLegalSlug(parseLegalSlugFromPathname(path));
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

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

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cs-bg)] text-[var(--cs-ink)]">
      <Navbar
        onLogoClick={() => navigateToPath('/')}
        onStartClick={openCreator}
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
        {legalSlug ? (
          <LegalPage
            slug={legalSlug}
            onNavigateHome={() => navigateToPath('/')}
            onNavigateLegal={(slug) => navigateToPath(LEGAL_ROUTES[slug].path)}
          />
        ) : (
          <>
            <HeroSection onStartClick={openCreator} />
            <CategoriesSection />
            <ExamplesGallerySection onStartClick={openCreator} />
            <HowItWorksSection />
            <BottomCtaSection onStartClick={openCreator} />

            {isAdmin ? (
              <section className="cs-sec" aria-label="Pannello Admin">
                <div className="cs-wrap space-y-6">
                  <AdminInvitesPanel />
                  <AdminTelemetryPanel latestTelemetry={latestTelemetry} />
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>

      <SiteFooter
        isSigningIn={isSigningIn}
        isAdmin={isAdmin}
        userEmail={user?.email ?? null}
        onNavigateHome={() => navigateToPath('/')}
        onNavigateLegal={(slug) => navigateToPath(LEGAL_ROUTES[slug].path)}
        onSignIn={() => void signInWithGoogle()}
        onSignOut={() => void signOutUser()}
      />

      <CreatorDialog
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        accessSession={accessSession}
        onAccessSessionChange={handleAccessSessionChange}
        onInviteQuotaUpdate={handleInviteQuotaUpdate}
        onTelemetryGenerated={setLatestTelemetry}
      />
    </div>
  );
}
