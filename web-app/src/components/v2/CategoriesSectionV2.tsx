import { Mountain, PawPrint, Puzzle, User } from 'lucide-react';
import { SITE_TEMPLATE, type CategoryTagItem } from '../../config/siteTemplate';

const TAG_BG_CLASSES: Record<CategoryTagItem['tone'], string> = {
  yellow: 'bg-[var(--cs-yellow)]',
  pink: 'bg-[var(--cs-pink)]',
  mint: 'bg-[var(--cs-mint)]',
  lavender: 'bg-[var(--cs-lavender)]',
};

function renderCategoryIcon(tone: CategoryTagItem['tone']) {
  switch (tone) {
    case 'yellow':
      return <PawPrint className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'pink':
      return <Puzzle className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'mint':
      return <Mountain className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'lavender':
      return <User className="h-4 w-4 shrink-0" aria-hidden="true" />;
  }
}

export interface CategoriesSectionV2Props {
  activeCategoryLabel?: string;
  onSelectCategory: (label: string) => void;
}

export function CategoriesSectionV2({
  activeCategoryLabel,
  onSelectCategory,
}: CategoriesSectionV2Props) {
  const { categories } = SITE_TEMPLATE;

  return (
    <section className="cs-sec !py-[26px]">
      <div className="cs-wrap">
        <h2 className="text-[1.8rem] font-bold leading-[1.08] tracking-[-0.02em]">
          {categories.title}
        </h2>
        <div
          role="group"
          aria-label={categories.title}
          className="my-[14px] flex flex-wrap gap-[10px]"
        >
          {categories.tags.map((tag) => {
            const isSelected = activeCategoryLabel === tag.label;
            return (
              <button
                key={tag.label}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectCategory(tag.label)}
                className={`cs-v2-cat-btn ${TAG_BG_CLASSES[tag.tone]}`}
              >
                {renderCategoryIcon(tag.tone)}
                <span>{tag.label}</span>
              </button>
            );
          })}
        </div>
        <p>{categories.note}</p>
      </div>
    </section>
  );
}
