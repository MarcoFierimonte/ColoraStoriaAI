import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { UiButton } from '../ui';
import { ExamplesCarousel } from './ExamplesCarousel';

export interface HeroSectionProps {
  onStartClick: () => void;
}

export function HeroSection({ onStartClick }: HeroSectionProps) {
  const { hero } = SITE_TEMPLATE;

  return (
    <div className="cs-wrap">
      <section className="cs-hero">
        <div>
          <h1 className="text-[clamp(2.1rem,9.5vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.03em]">
            {hero.titleStart}
            <span className="cs-mk">{hero.titleHighlight}</span>
          </h1>
          <p className="mt-[14px] max-w-[34ch] text-[1.1rem]">
            {hero.subtitle}
          </p>
          <UiButton
            className="mt-[20px] max-w-[320px]"
            onClick={onStartClick}
          >
            {hero.primaryCtaLabel}
          </UiButton>
        </div>

        <ExamplesCarousel />
      </section>
    </div>
  );
}
