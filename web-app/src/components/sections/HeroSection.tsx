import type { RefObject } from 'react';
import { ShieldCheck, Ticket } from 'lucide-react';
import { SITE_TEMPLATE } from '../../config/siteTemplate';
import type { AccessSessionResponse } from '../../modules/beta-access';
import { UiBadge, UiButton } from '../ui';
import { ExamplesCarousel } from './ExamplesCarousel';

export interface HeroSectionProps {
  isAdmin: boolean;
  accessSession: AccessSessionResponse | null;
  activeSlideIndex: number;
  carouselScrollRequest: { index: number; seq: number } | null;
  carouselSectionRef: RefObject<HTMLElement | null>;
  ctaSentinelRef: RefObject<HTMLDivElement | null>;
  onActiveSlideChange: (index: number) => void;
  onStartClick: () => void;
}

export function HeroSection({
  isAdmin,
  accessSession,
  activeSlideIndex,
  carouselScrollRequest,
  carouselSectionRef,
  ctaSentinelRef,
  onActiveSlideChange,
  onStartClick,
}: HeroSectionProps) {
  const { hero, creator } = SITE_TEMPLATE;
  const activeInvite =
    accessSession?.accessSource === 'invite' ? accessSession.invite : null;

  return (
    <div className="cs-wrap">
      <section className="cs-hero">
        <div className="min-w-0">
          {isAdmin ? (
            <div className="mb-2.5">
              <UiBadge
                tone="mint"
                className="inline-flex items-center gap-1.5 !py-1 !px-2.5"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Admin</span>
              </UiBadge>
            </div>
          ) : activeInvite ? (
            <div className="mb-2.5">
              <UiBadge
                tone="mint"
                className="inline-flex items-center gap-1.5 font-mono-num !py-1 !px-2.5"
              >
                <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Invito: {activeInvite.label} ·{' '}
                  {activeInvite.remainingGenerations}/
                  {activeInvite.maxGenerations}
                </span>
              </UiBadge>
            </div>
          ) : accessSession?.inviteRequired ? (
            <div className="mb-2.5">
              <UiBadge
                tone="yellow"
                className="inline-flex items-center gap-1.5 !py-1 !px-2.5"
              >
                <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{creator.inviteGateTitle}</span>
              </UiBadge>
            </div>
          ) : null}

          <h1 className="text-[clamp(1.85rem,7.8vw,3.5rem)] font-bold leading-[1.03] tracking-[-0.03em]">
            {hero.titleStart}
            <span className="cs-mk">{hero.titleHighlight}</span>
          </h1>
          <p className="mt-2.5 sm:mt-[14px] max-w-[36ch] text-[1rem] sm:text-[1.1rem]">
            {hero.subtitle}
          </p>

          <div ref={ctaSentinelRef} className="mt-3.5 sm:mt-5">
            <UiButton className="max-w-[320px]" onClick={onStartClick}>
              {hero.primaryCtaLabel}
            </UiButton>
          </div>
        </div>

        <ExamplesCarousel
          activeIndex={activeSlideIndex}
          scrollRequest={carouselScrollRequest}
          sectionRef={carouselSectionRef}
          onActiveIndexChange={onActiveSlideChange}
        />
      </section>
    </div>
  );
}
