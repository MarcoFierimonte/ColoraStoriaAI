import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { UiButton } from '../ui';

export interface BottomCtaSectionProps {
  onStartClick: () => void;
}

export function BottomCtaSection({ onStartClick }: BottomCtaSectionProps) {
  const { bottomCta } = SITE_TEMPLATE;

  return (
    <section className="cs-wrap px-4 pt-[40px] pb-[30px] text-center">
      <h2 className="text-[1.9rem] font-bold tracking-[-0.02em]">
        {bottomCta.title}
      </h2>
      <UiButton
        className="mx-auto mt-[18px] max-w-[320px]"
        onClick={onStartClick}
      >
        {bottomCta.buttonLabel}
      </UiButton>
      <small className="mt-[14px] block text-[0.85rem]">
        {bottomCta.note}
      </small>
    </section>
  );
}
