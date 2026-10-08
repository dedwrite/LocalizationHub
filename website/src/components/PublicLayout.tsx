import type {ReactNode} from 'react'
import {LanguageSwitcher, useI18n} from '@localizationhub/i18n'
import {ActionLink, UiTheme} from '@localizationhub/ui'
import {InternalLink} from '../internalNavigation'
import {FooterSecret} from '../delight/LittleSecrets'
import CreatorCredit from './CreatorCredit'
import Brand from './Brand'
import '../productHome/home.css'

/** The reading surfaces extend the approved product world, not the old landing. */
export default function PublicLayout({children}: {children: ReactNode}) {
  const {t, locale} = useI18n()
  return <UiTheme className="product-home public-reading"><div className="home-shell" dir={locale === 'ar' ? 'rtl' : 'ltr'} data-i18n-skip>
    <a className="home-skip" href="#main-content">{t('website.skipContent')}</a>
    <header className="home-header">
      <InternalLink href="/" className="home-brand"><Brand /></InternalLink>
      <nav aria-label={t('home.nav')}><ActionLink href="/">{t('product.home')}</ActionLink><ActionLink href="/product">{t('home.product')}</ActionLink><ActionLink href="/reference">{t('home.docs')}</ActionLink><LanguageSwitcher /><ActionLink href="/app/local" variant="primary">{t('home.open')}</ActionLink></nav>
    </header>
    {children}
    <footer className="home-footer"><span>{t('home.footer')}</span><div><ActionLink href="/download">{t('home.download')}</ActionLink><ActionLink href="/privacy">{t('legal.privacy.kicker')}</ActionLink><ActionLink href="/terms">{t('legal.terms.kicker')}</ActionLink><CreatorCredit /><FooterSecret /></div></footer>
  </div></UiTheme>
}
