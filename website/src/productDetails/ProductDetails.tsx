import {LanguageSwitcher, useI18n} from '@localizationhub/i18n'
import {ActionLink, UiTheme} from '@localizationhub/ui'
import {ContextDemo, TokenDemo, LocalDemo, ExtractionDemo, ReviewDemo, MemoryDemo} from './ProductDemos'
import FormatGuide from '../components/FormatGuide'
import {EngineMatrix} from '../pages/LandingPage'
import TipCard from '../delight/TipCard'
import AmbientGreeting from '../delight/AmbientGreeting'
import CreatorCredit from '../components/CreatorCredit'
import Brand from '../components/Brand'
import {FaqLocaleSecret, FooterSecret, OnDeviceSecret} from '../delight/LittleSecrets'
import '../productHome/home.css'
import './product-details.css'

export default function ProductDetails() {
  const {t, locale} = useI18n()
  const sections = [
    ['context', 'context', ContextDemo], ['workspace', 'tokens', TokenDemo],
    ['cloud', 'local', LocalDemo], ['extraction', 'extract', ExtractionDemo],
    ['workflow', 'review', ReviewDemo], ['memory', 'memory', MemoryDemo],
  ] as const
  return <UiTheme className="product-home product-details"><div className="home-shell" dir={locale === 'ar' ? 'rtl' : 'ltr'} data-i18n-skip>
    <a className="home-skip" href="#product">{t('home.skip')}</a>
    <header className="home-header"><a className="home-brand" href="/"><Brand /></a><nav aria-label={t('home.nav')}><ActionLink href="/">{t('product.home')}</ActionLink><ActionLink href="/reference">{t('home.docs')}</ActionLink><LanguageSwitcher /><ActionLink href="/app/local" variant="primary">{t('home.open')}</ActionLink></nav></header>
    <main id="product"><div className="pd-intro"><p className="home-kicker">{t('product.kicker')}</p><h1>{t('product.title')}</h1><p>{t('product.body')}</p></div>
      {sections.map(([id, name, Demo]) => <section id={id} key={id} className="pd-row" aria-labelledby={`${id}-title`}><div className="pd-copy"><p className="home-kicker">{t(`product.${name}.label`)}</p><h2 id={`${id}-title`}>{t(`product.${name}.title`)}</h2><p>{t(`product.${name}.body`)}</p>{name === 'local' && <><OnDeviceSecret label={t('product.browser')} /><p>{t('product.local.note')}</p></>}</div><Demo /></section>)}
      <section className="pd-support" aria-labelledby="pd-support-title"><h2 id="pd-support-title">{t('product.support')}</h2><FormatGuide /><div id="engines"><EngineMatrix /></div></section>
      <section className="pd-support" id="privacy"><h2>{t('legal.privacy.kicker')}</h2><p>{t('product.local.note')}</p><ActionLink href="/privacy">{t('legal.privacy.kicker')}</ActionLink></section>
      <section className="pd-support"><AmbientGreeting /><TipCard context="landing" /></section>
      <section id="faq" className="pd-support"><h2>{t('website.faq.titleStart')} {t('website.faq.titleEnd')}<FaqLocaleSecret /></h2>{([['landing.faq.windowsQuestion','landing.download.access'],['website.faq.offlineQuestion','website.faq.offlineAnswer'],['website.faq.localQuestion','website.faq.localAnswer'],['website.faq.mtPrivacyQuestion','website.faq.mtPrivacyAnswer']] as const).map(([q,a]) => <details key={q}><summary>{t(q)}</summary><p>{t(a)}</p></details>)}</section>
      <section className="pd-closing"><h2>{t('product.closing.title')}</h2><p>{t('product.closing.note')}</p><ActionLink href="/app/local" variant="primary">{t('home.open')}</ActionLink><ActionLink href="/download">{t('home.download')}</ActionLink></section>
    </main><footer className="home-footer"><span>{t('home.footer')}</span><CreatorCredit /><FooterSecret /><ActionLink href="/terms">{t('legal.terms.kicker')}</ActionLink></footer>
  </div></UiTheme>
}
