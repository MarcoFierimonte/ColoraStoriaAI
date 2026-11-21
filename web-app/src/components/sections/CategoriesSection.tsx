import { SITE_TEMPLATE, type CategoryTagItem } from '../../config/siteTemplate';

const TAG_BG_CLASSES: Record<CategoryTagItem['tone'], string> = {
  yellow: 'bg-[var(--cs-yellow)]',
  pink: 'bg-[var(--cs-pink)]',
  mint: 'bg-[var(--cs-mint)]',
  lavender: 'bg-[var(--cs-lavender)]',
};

export function CategoriesSection() {
  const { categories } = SITE_TEMPLATE;

  return (
    <section className="cs-sec !py-[26px]">
      <div className="cs-wrap">
        <h2 className="text-[1.8rem] font-bold leading-[1.08] tracking-[-0.02em]">
          {categories.title}
        </h2>
        <ul className="my-[14px] flex list-none flex-wrap gap-[10px] p-0">
          {categories.tags.map((tag) => (
            <li
              key={tag.label}
              className={`cs-tag-pill ${TAG_BG_CLASSES[tag.tone]}`}
            >
              {tag.label}
            </li>
          ))}
        </ul>
        <p>{categories.note}</p>
      </div>
    </section>
  );
}
