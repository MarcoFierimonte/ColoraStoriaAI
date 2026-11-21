import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { UiButton } from '../ui';

export interface NavbarProps {
  onLogoClick: () => void;
  onStartClick: () => void;
}

export function Navbar({ onLogoClick, onStartClick }: NavbarProps) {
  return (
    <header className="cs-wrap">
      <nav className="flex items-center justify-between py-[14px]" aria-label="Principale">
        <a
          href="/"
          className="cs-logo"
          onClick={(event) => {
            event.preventDefault();
            onLogoClick();
          }}
        >
          {SITE_TEMPLATE.brand.name}
        </a>
        <UiButton
          variant="secondary"
          size="compact"
          onClick={onStartClick}
        >
          {SITE_TEMPLATE.brand.navCtaLabel}
        </UiButton>
      </nav>
    </header>
  );
}
