import { useI18n } from '@localizationhub/i18n'
import { site } from '../config/site'
import { Header, Footer } from '../components/SiteChrome'
import { InternalLink } from '../internalNavigation'

export function DownloadPage() {
  const { t } = useI18n()
  return (
    <>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        data-i18n-skip
        className="inner-page download-page"
      >
        <p className="eyebrow">
          {t('website.download.releasePrefix')}
          {site.version}
        </p>
        <div className="download-layout">
          <div>
            <h1>
              LocalizationHub
              <br />
              <i>{site.releaseTitle}</i>
            </h1>
            <p className="page-lede">{t('website.download.description')}</p>
            <p className="download-access-note">
              {t('landing.download.access')}
            </p>
            <InternalLink className="button button-primary" href="/app/local">
              {t('website.hero.openLocal')}
            </InternalLink>
            <a className="button button-quiet" href={site.releaseUrl}>
              {t('website.download.github')}
              <span>↗</span>
            </a>
          </div>
          <div className="download-panel">
            <div className="panel-mark">
              <img src="/localizationhub-logo.jpg" alt="" />
            </div>
            <span className="panel-kicker">{t('website.download.stable')}</span>
            <h2>
              {t('website.hero.versionPrefix')}
              {site.version}
            </h2>
            <div className="download-fact">
              <span>{t('website.download.installer')}</span>
              <strong data-i18n-skip>
                {['LocalizationHub_', site.version, '_x64-setup.exe'].join('')}
              </strong>
            </div>
            <div className="download-fact">
              <span>{t('website.download.platform')}</span>
              <strong>Windows x64</strong>
            </div>
            <div className="download-fact">
              <span>{t('website.download.worksWith')}</span>
              <strong>{t('website.download.compatibility')}</strong>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export function DocumentPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const { t } = useI18n()
  const privacy = kind === 'privacy'
  const privacySections: Array<[string, string]> = [
    [t('website.surface.localProjects'), t('legal.privacy.local')],
    [t('website.surface.cloudProjects'), t('legal.privacy.cloud')],
    [t('legal.heading.accounts'), t('legal.privacy.accounts')],
    [t('legal.heading.projectData'), t('legal.privacy.projectData')],
    [t('legal.heading.retention'), t('legal.privacy.retention')],
    [t('legal.heading.deletion'), t('legal.privacy.deletion')],
    [t('legal.heading.logs'), t('legal.privacy.logs')],
    [t('legal.heading.analytics'), t('legal.privacy.analytics')],
    [t('legal.heading.apiKeys'), t('legal.privacy.apiKeys')],
    [t('legal.heading.infrastructure'), t('legal.privacy.infrastructure')],
    [t('legal.heading.music'), t('legal.privacy.music')],
    [t('legal.heading.contact'), t('legal.privacy.contact')],
    [t('legal.heading.future'), t('legal.privacy.future')],
  ]
  const termsSections: Array<[string, string]> = [
    [t('legal.terms.using'), t('legal.terms.usingText')],
    [t('legal.terms.localBackups'), t('legal.terms.localBackupsText')],
    [t('website.surface.cloudProjects'), t('legal.terms.cloudText')],
    [t('legal.heading.accounts'), t('legal.terms.accountsText')],
    [t('legal.terms.availability'), t('legal.terms.availabilityText')],
    [t('legal.terms.releases'), t('legal.terms.releasesText')],
    [t('legal.terms.changes'), t('legal.terms.changesText')],
  ]
  return (
    <>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        data-i18n-skip
        className="inner-page document-page"
      >
        <p className="eyebrow">
          {t('website.document.prefix')}
          {privacy ? t('legal.privacy.kicker') : t('legal.terms.kicker')}
        </p>
        <article>
          <h1>{privacy ? t('legal.privacy.title') : t('legal.terms.title')}</h1>
          <p className="page-lede">
            {privacy ? t('legal.privacy.intro') : t('legal.terms.intro')}
          </p>
          {(privacy ? privacySections : termsSections).map(
            ([heading, text]) => (
              <section key={heading}>
                <h2>{heading}</h2>
                <p>{text}</p>
              </section>
            ),
          )}
        </article>
      </main>
      <Footer />
    </>
  )
}

export function NotFound() {
  const { t } = useI18n()
  return (
    <>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        data-i18n-skip
        className="inner-page not-found"
      >
        <p className="eyebrow">{t('website.notFound.kicker')}</p>
        <h1>{t('website.notFound.title')}</h1>
        <p>{t('website.notFound.description')}</p>
        <InternalLink className="button button-primary" href="/">
          {t('website.notFound.back')}
        </InternalLink>
      </main>
      <Footer />
    </>
  )
}
