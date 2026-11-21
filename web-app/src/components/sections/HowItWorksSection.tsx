import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { UiCard } from '../ui';

export function HowItWorksSection() {
  const { howItWorks } = SITE_TEMPLATE;

  return (
    <section id="come-funziona" className="cs-sec">
      <div className="cs-wrap">
        <h2 className="mb-4 text-[1.8rem] font-bold leading-[1.08] tracking-[-0.02em]">
          {howItWorks.title}
        </h2>
        <div className="grid gap-4 min-[860px]:grid-cols-3">
          {howItWorks.steps.map((step) => (
            <UiCard key={step.number}>
              <span className="cs-num">{step.number}</span>
              <h3 className="mb-1 text-[1.2rem] font-bold">{step.title}</h3>
              <p>{step.description}</p>
            </UiCard>
          ))}
        </div>
      </div>
    </section>
  );
}
