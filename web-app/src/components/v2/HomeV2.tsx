import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, FileDown, Sparkles, Upload } from 'lucide-react';
import { SITE_TEMPLATE } from '../../config/siteTemplate';
import type { AccessSessionResponse } from '../../modules/beta-access';
import { BottomCtaSection } from '../sections';
import { UiBadge, UiButton, UiCard } from '../ui';
import { CategoriesSectionV2 } from './CategoriesSectionV2';
import { HeroSectionV2 } from './HeroSectionV2';

export interface HomeV2Props {
  isAdmin: boolean;
  accessSession: AccessSessionResponse | null;
  creatorOpen: boolean;
  onStartClick: () => void;
  onSwitchToV1: () => void;
}

const STEP_ICONS = [Upload, Sparkles, FileDown] as const;

export function HomeV2({
  isAdmin,
  accessSession,
  creatorOpen,
  onStartClick,
  onSwitchToV1,
}: HomeV2Props) {
  const { hero, examplesGallery, howItWorks } = SITE_TEMPLATE;

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [scrollRequest, setScrollRequest] = useState<{
    index: number;
    seq: number;
  } | null>(null);
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);
  const [bottomCtaVisible, setBottomCtaVisible] = useState(false);

  const carouselSectionRef = useRef<HTMLElement | null>(null);
  const heroCtaSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomCtaSentinelRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const heroTarget = heroCtaSentinelRef.current;
    const bottomTarget = bottomCtaSentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === heroTarget) {
            setHeroCtaVisible(entry.isIntersecting);
          } else if (entry.target === bottomTarget) {
            setBottomCtaVisible(entry.isIntersecting);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (heroTarget) observer.observe(heroTarget);
    if (bottomTarget) observer.observe(bottomTarget);

    return () => observer.disconnect();
  }, []);

  const handleSelectCategory = useCallback(
    (categoryLabel: string) => {
      const items = examplesGallery.items;
      const matchingIndices = items.reduce<number[]>((acc, item, index) => {
        if (item.categoryLabel === categoryLabel) {
          acc.push(index);
        }
        return acc;
      }, []);

      if (matchingIndices.length === 0) return;

      const currentMatchPos = matchingIndices.indexOf(activeSlideIndex);
      const nextIndex =
        currentMatchPos >= 0
          ? matchingIndices[(currentMatchPos + 1) % matchingIndices.length]
          : matchingIndices[0];

      seqRef.current += 1;
      setScrollRequest({ index: nextIndex, seq: seqRef.current });

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      carouselSectionRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
      });
    },
    [activeSlideIndex, examplesGallery.items]
  );

  const activeCategoryLabel =
    examplesGallery.items[activeSlideIndex]?.categoryLabel;
  const showMobileDock = !creatorOpen && !heroCtaVisible && !bottomCtaVisible;

  return (
    <div className={showMobileDock ? 'pb-[84px] md:pb-0' : ''}>
      {/* Non-intrusive switcher strip so the user can compare /v2 vs / effortlessly */}
      <div className="cs-wrap pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs font-bold">
          <div className="flex items-center gap-2">
            <UiBadge tone="lavender" className="!py-0.5 !px-2 font-mono-num">
              UX v2
            </UiBadge>
            <span className="text-[var(--cs-ink-muted)]">/v2</span>
          </div>
          <button
            type="button"
            onClick={onSwitchToV1}
            className="inline-flex items-center gap-1.5 rounded-[8px] border-2 border-[var(--cs-border)] bg-[var(--cs-yellow)] px-2.5 py-1 text-xs font-bold text-[var(--cs-ink)] cursor-pointer hover:bg-[var(--cs-mint)]"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Versione attuale (v1)</span>
          </button>
        </div>
      </div>

      <HeroSectionV2
        isAdmin={isAdmin}
        accessSession={accessSession}
        activeSlideIndex={activeSlideIndex}
        carouselScrollRequest={scrollRequest}
        carouselSectionRef={carouselSectionRef}
        ctaSentinelRef={heroCtaSentinelRef}
        onActiveSlideChange={setActiveSlideIndex}
        onStartClick={onStartClick}
      />

      <CategoriesSectionV2
        activeCategoryLabel={activeCategoryLabel}
        onSelectCategory={handleSelectCategory}
      />

      <section id="come-funziona" className="cs-sec">
        <div className="cs-wrap">
          <h2 className="mb-4 text-[1.8rem] font-bold leading-[1.08] tracking-[-0.02em]">
            {howItWorks.title}
          </h2>
          <div className="grid gap-4 min-[860px]:grid-cols-3">
            {howItWorks.steps.map((step, idx) => {
              const Icon = STEP_ICONS[idx] ?? Sparkles;
              return (
                <UiCard key={step.number}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="cs-num !mb-0">{step.number}</span>
                    <span
                      aria-hidden="true"
                      className="inline-grid h-9 w-9 place-items-center rounded-[9px] border-2 border-[var(--cs-border)] bg-[var(--cs-sky)] text-[var(--cs-ink)]"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <h3 className="mb-1 text-[1.2rem] font-bold">{step.title}</h3>
                  <p>{step.description}</p>
                </UiCard>
              );
            })}
          </div>
        </div>
      </section>

      <div ref={bottomCtaSentinelRef}>
        <BottomCtaSection onStartClick={onStartClick} />
      </div>

      {showMobileDock ? (
        <div className="cs-v2-mobile-dock md:hidden">
          <UiButton onClick={onStartClick}>{hero.primaryCtaLabel}</UiButton>
        </div>
      ) : null}
    </div>
  );
}
