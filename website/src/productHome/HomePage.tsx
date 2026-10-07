import React from 'react'
import { LanguageSwitcher, useI18n } from '@localizationhub/i18n'
import { ActionLink, UiTheme } from '@localizationhub/ui'
import { navigateInternal, shouldInterceptClick } from '../internalNavigation'
import { legacyProductDestination } from './legacyAnchors'
import EditorDemo from './EditorDemo'
import CreatorCredit from '../components/CreatorCredit'
import '@localizationhub/ui/theme.css'
import './home.css'

export default function HomePage() {
  const {t, locale} = useI18n()
  React.useEffect(() => {
    const redirect = () => { const destination = legacyProductDestination(window.location.hash); if (destination) navigateInternal(destination, {replace: true}) }
    redirect()
    window.addEventListener('hashchange', redirect)
    return () => window.removeEventListener('hashchange', redirect)
  }, [])
  return <UiTheme className="product-home"><div className="home-shell" dir={locale === 'ar' ? 'rtl' : 'ltr'} data-i18n-skip onClick={event => {
    const anchor = (event.target as Element).closest('a')
    if (!anchor || event.defaultPrevented || anchor.target || anchor.hasAttribute('download')) return
    const href = anchor.getAttribute('href') ?? ''
    if (shouldInterceptClick(event, href)) { event.preventDefault(); navigateInternal(href) }
  }}>
    <a className="home-skip" href="#home-editor">{t('home.skip')}</a>
    <header className="home-header">
      <a href="/" className="home-brand" aria-label="LocalizationHub"><span className="home-mark" aria-hidden="true"><span /></span><span>LocalizationHub</span></a>
      <nav aria-label={t('home.nav')}><ActionLink href="/product">{t('home.product')}</ActionLink><ActionLink href="/reference">{t('home.docs')}</ActionLink><LanguageSwitcher /><ActionLink href="/app/local" variant="primary">{t('home.open')}</ActionLink></nav>
    </header>
    <main>
      <section className="home-intro" aria-labelledby="home-title">
        <p className="home-kicker">{t('home.kicker')}</p>
        <h1 id="home-title">{t('home.title')}</h1>
        <p className="home-subtitle">{t('home.subtitle')}</p>
        <div className="home-actions"><ActionLink href="/app/local" variant="primary">{t('home.open')}</ActionLink><ActionLink href="/product">{t('home.details')}</ActionLink><ActionLink href="https://github.com/dedwrite/LocalizationHub" target="_blank" rel="noopener noreferrer">{t('home.github')}</ActionLink><ActionLink href="/download">{t('home.download')}</ActionLink><ActionLink href="/reference">{t('home.docs')}</ActionLink></div>
      </section>
      <EditorDemo />
    </main>
    <footer className="home-footer"><span>{t('home.localNote')}</span><div><ActionLink href="/privacy">{t('legal.privacy.kicker')}</ActionLink><ActionLink href="/terms">{t('legal.terms.kicker')}</ActionLink><CreatorCredit /><span>{t('home.footer')}</span></div></footer>
  </div></UiTheme>
}
