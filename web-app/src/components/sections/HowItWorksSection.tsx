import { FileDown, Sparkles, Upload } from 'lucide-react';
import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { UiCard } from '../ui';

const STEP_ICONS = [Upload, Sparkles, FileDown] as const;

export function HowItWorksSection() {
  const { howItWorks } = SITE_TEMPLATE;

  return (
    <section id="come-funziona" className="cs-sec scroll-mt-16">
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
  );
}
