import { LanguageSwitcher, useI18n } from '@localizationhub/i18n'
import { site } from '../config/site'
import useScrollReveal from '../hooks/useScrollReveal'
import MotionDebugBadge from './MotionDebugBadge'
import { InternalLink } from '../internalNavigation'
import { openCommandCenter } from '../delight/CommandCenter'
import { FooterSecret } from '../delight/LittleSecrets'

function navigation(t: ReturnType<typeof useI18n>['t']) {
  return [
    [t('website.nav.product'), '/#product'],
    [t('website.nav.webApp'), '/app'],
    [t('website.nav.download'), '/download'],
    ['GitHub', site.repositoryUrl],
  ]
}

export function Header() {
  const motionState = useScrollReveal()
  const { t } = useI18n()
  return (
    <>
      <a className="skip-content" href="#main-content" data-i18n-skip>
        {t('website.skipContent')}
      </a>
      <header className="site-header" data-i18n-skip>
        <InternalLink className="brand" href="/">
          <img className="brand-icon" src="/localizationhub-logo.jpg" alt="" />
          <span>{site.name}</span>
        </InternalLink>
        <nav className="main-nav" aria-label={t('website.nav.label')}>
          {navigation(t).map(([label, href]) => (
            <InternalLink key={label} href={href}>
              {label}
            </InternalLink>
          ))}
        </nav>
        <LanguageSwitcher />
        <button
          type="button"
          className="command-launcher site-command-launcher"
          onClick={() => openCommandCenter()}
          aria-label={t('delight.command.open')}
        >
          <span>{t('delight.command.quick')}</span>
          <kbd>⌘K</kbd>
        </button>
        <InternalLink className="header-cta" href="/app/local">
          {t('website.hero.openLocal')}
        </InternalLink>
      </header>
      <MotionDebugBadge state={motionState} />
    </>
  )
}

export function Footer() {
  const { t } = useI18n()
  return (
    <footer data-i18n-skip>
      <InternalLink className="brand" href="/">
        <img className="brand-icon" src="/localizationhub-logo.jpg" alt="" />
        <span>{site.name}</span>
      </InternalLink>
      <span>
        <bdi>v{site.version}</bdi> · {t('website.footer.release')}
      </span>
      <div>
        <a href={site.repositoryUrl}>GitHub</a>
        <a href={site.releaseUrl}>{t('website.footer.releases')}</a>
        <InternalLink href="/privacy">{t('legal.privacy.kicker')}</InternalLink>
        <InternalLink href="/terms">{t('legal.terms.kicker')}</InternalLink>
        <a
          className="creator-signature"
          href="https://dedwrite.xyz/"
          target="_blank"
          rel="noopener noreferrer"
        >
          DEDWRITE
        </a>
        <FooterSecret />
      </div>
    </footer>
  )
}
