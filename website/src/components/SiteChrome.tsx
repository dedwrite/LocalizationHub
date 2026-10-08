import { LanguageSwitcher, useI18n } from "@localizationhub/i18n";
import { site } from "../config/site";
import useScrollReveal from "../hooks/useScrollReveal";
import MotionDebugBadge from "./MotionDebugBadge";
import { InternalLink } from "../internalNavigation";
import { openCommandCenter } from "../delight/commandEvents";
import { FooterSecret } from "../delight/LittleSecrets";
import ShortcutKey from './ShortcutKey';
import Icon from './Icon';
import CreatorCredit from './CreatorCredit';
import Brand from './Brand';

function navigation(t: ReturnType<typeof useI18n>["t"]) {
  return [
    [t("landing.nav.editor"), "/product#context"],
    [t("landing.nav.files"), "/product#engines"],
    [t("website.nav.webApp"), "/app"],
    [t("website.nav.download"), "/download"],
  ];
}

export function Header() {
  const motionState = useScrollReveal();
  const { t } = useI18n();
  return (
    <>
      <a className="skip-content" href="#main-content" data-i18n-skip>
        {t("website.skipContent")}
      </a>
      <header className="site-header" data-i18n-skip>
        <InternalLink className="brand" href="/">
          <Brand />
        </InternalLink>
        <nav className="main-nav" aria-label={t("website.nav.label")}>
          {navigation(t).map(([label, href]) => (
            <InternalLink key={label} href={href}>
              {label}
            </InternalLink>
          ))}
        </nav>
        <details className="mobile-site-menu">
          <summary aria-label={t('landing.nav.menu')}>{t('landing.nav.menu')}<Icon name="menu" size={18} /></summary>
          <nav aria-label={t('website.nav.label')}>
            {navigation(t).map(([label, href]) => <InternalLink key={label} href={href} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open') }}>{label}<Icon name="arrow-up-right" size={14} /></InternalLink>)}
          </nav>
        </details>
        <LanguageSwitcher />
        <button
          type="button"
          className="command-launcher site-command-launcher"
          onClick={() => openCommandCenter()}
          aria-label={t("delight.command.open")}
        >
          <span>{t("delight.command.quick")}</span>
          <ShortcutKey />
        </button>
        <InternalLink className="header-cta" href="/app/local">
          {t("website.hero.openLocal")}
        </InternalLink>
      </header>
      <MotionDebugBadge state={motionState} />
    </>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer data-i18n-skip>
      <InternalLink className="brand" href="/">
        <img className="brand-icon" src="/brand-mono.svg" alt="" />
        <span>{site.name}</span>
      </InternalLink>
      <span>{t("website.footer.release")}</span>
      {/* No repository or release links: the desktop build is private, so a
          public link would send visitors to a 404. */}
      <div>
        <InternalLink href="/download">{t("website.nav.download")}</InternalLink>
        <InternalLink href="/reference">{t("capability.index.nav")}</InternalLink>
        <InternalLink href="/privacy">{t("legal.privacy.kicker")}</InternalLink>
        <InternalLink href="/terms">{t("legal.terms.kicker")}</InternalLink>
        <a href={`mailto:${site.contactEmail}`}>{t("website.footer.contact")}</a>
        <CreatorCredit />
        <FooterSecret />
      </div>
    </footer>
  );
}
