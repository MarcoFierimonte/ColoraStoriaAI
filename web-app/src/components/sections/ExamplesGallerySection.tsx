import { useState } from 'react';
import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { ModalDialog, UiBadge, UiButton, UiCard } from '../ui';
import { ExampleTrio, type ExampleTilePreview } from './ExampleTrio';

export interface ExamplesGallerySectionProps {
  onStartClick: () => void;
}

export function ExamplesGallerySection({
  onStartClick,
}: ExamplesGallerySectionProps) {
  const { examplesGallery } = SITE_TEMPLATE;
  const [zoomedTile, setZoomedTile] = useState<ExampleTilePreview | null>(null);

  return (
    <section
      id={examplesGallery.id}
      className="cs-sec"
      aria-labelledby="esempi-title"
    >
      <div className="cs-wrap space-y-6">
        <div className="space-y-2">
          <h2
            id="esempi-title"
            className="text-[1.8rem] font-bold leading-[1.08] tracking-[-0.02em]"
          >
            {examplesGallery.title}
          </h2>
          <p className="max-w-[58ch]">{examplesGallery.subtitle}</p>
          <p className="text-sm font-medium text-[var(--cs-ink-muted)]">
            {examplesGallery.zoomHint}
          </p>
        </div>

        <div className="grid gap-6 min-[860px]:grid-cols-2">
          {examplesGallery.items.map((item) => (
            <UiCard key={item.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[1.15rem] font-bold leading-tight">
                  {item.title ?? item.ariaLabel}
                </h3>
                {item.categoryLabel ? (
                  <UiBadge tone={item.categoryTone ?? 'yellow'}>
                    {item.categoryLabel}
                  </UiBadge>
                ) : null}
              </div>

              <ExampleTrio
                item={item}
                fullWidth
                loading="lazy"
                onTileClick={(tile) =>
                  setZoomedTile({
                    ...tile,
                    title: item.title,
                  })
                }
              />
            </UiCard>
          ))}
        </div>

        <div className="flex justify-center pt-1">
          <UiButton className="max-w-[320px]" onClick={onStartClick}>
            {examplesGallery.ctaLabel}
          </UiButton>
        </div>
      </div>

      <ModalDialog
        open={zoomedTile !== null}
        size="examples"
        title={zoomedTile?.title ?? examplesGallery.title}
        closeLabel={examplesGallery.zoomCloseLabel}
        onRequestClose={() => setZoomedTile(null)}
      >
        {zoomedTile ? (
          <div className="space-y-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-1">
            <div className="flex items-center gap-2">
              <UiBadge tone={zoomedTile.badgeTone}>{zoomedTile.label}</UiBadge>
            </div>
            <img
              src={zoomedTile.src}
              alt={zoomedTile.alt}
              className="mx-auto max-h-[75dvh] w-auto max-w-full rounded-[10px] border-[3px] border-[var(--cs-border)] bg-white"
            />
            <p className="text-sm text-[var(--cs-ink-muted)]">
              {zoomedTile.alt}
            </p>
          </div>
        ) : null}
      </ModalDialog>
    </section>
  );
}
