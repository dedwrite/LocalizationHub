import { useI18n } from '@localizationhub/i18n'
import { site } from '../config/site'
import PublicLayout from '../components/PublicLayout'
import { InternalLink } from '../internalNavigation'

export function DownloadPage() {
  const { t } = useI18n()
  return (
    <PublicLayout>
      <main id="main-content" tabIndex={-1} data-i18n-skip className="inner-page download-page">
        <div className="download-layout">
          <div>
            <h1>{site.name}<br /><i>{t('website.download.titleAccent')}</i></h1>
            <p className="page-lede">{t('website.download.description')}</p>
            <p className="download-access-note">{t('landing.download.access')}</p>
            <a className="button button-primary" href={site.desktopRelease.installerUrl}>{t('website.download.downloadWindows')}</a>
            <a className="button button-quiet" href={site.releasesUrl}>{t('website.download.allReleases')}</a>
            <InternalLink className="button button-quiet" href="/app/local">{t('website.download.openEditor')}</InternalLink>
            <p className="download-access-note">{t('website.download.installWarning')}</p>
            <details className="download-verification">
              <summary>{t('website.download.verifyChecksum')}</summary>
              <p><a href={site.desktopRelease.checksumUrl}>{t('website.download.checksum')}</a></p>
              <p>{t('website.download.checksumHelp')}</p>
              <pre dir="ltr"><code>{`Get-FileHash -Algorithm SHA256 .\\LocalizationHub_${site.version}_x64-setup.exe`}</code></pre>
              <p><code className="download-digest" dir="ltr">{site.desktopRelease.sha256}</code></p>
            </details>
          </div>
          <div className="download-panel">
            <div className="panel-mark"><img src="/brand-alternative.svg" alt="" /></div>
            <span className="panel-kicker">{t('website.download.kicker')} · v{site.version}</span>
            <h2>{t('website.download.releaseTitle')}</h2>
            <div className="download-fact"><span>{t('website.download.platform')}</span><strong>{site.supportedPlatforms.join(' · ')}</strong></div>
            <div className="download-fact"><span>{t('website.download.reads')}</span><strong>{site.supportedEngines.map(({name}) => name).join(' · ')}</strong></div>
            <div className="download-fact"><span>{t('website.download.writes')}</span><strong>{site.supportedFormats.join(' · ')}</strong></div>
            <a href={site.desktopRelease.checksumUrl}>{t('website.download.checksum')}</a>
          </div>
        </div>
      </main>
    </PublicLayout>
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
  /* The second layer answers the questions the first layer raises: who owns
   * the work, what happens when a third-party service is connected, what a
   * visitor can expect from availability, and how either side ends the use. */
  const termsSections: Array<[string, string]> = [
    [t('legal.terms.using'), t('legal.terms.usingText')],
    [t('legal.terms.ownership'), t('legal.terms.ownershipText')],
    [t('legal.terms.localBackups'), t('legal.terms.localBackupsText')],
    [t('website.surface.cloudProjects'), t('legal.terms.cloudText')],
    [t('legal.heading.accounts'), t('legal.terms.accountsText')],
    [t('legal.terms.thirdParty'), t('legal.terms.thirdPartyText')],
    [t('legal.terms.uptime'), t('legal.terms.uptimeText')],
    [t('legal.terms.suspension'), t('legal.terms.suspensionText')],
    [t('legal.terms.termination'), t('legal.terms.terminationText')],
    [t('legal.terms.liability'), t('legal.terms.liabilityText')],
    [t('legal.terms.availability'), t('legal.terms.availabilityText')],
    [t('legal.terms.releases'), t('legal.terms.releasesText')],
    [t('legal.terms.changes'), t('legal.terms.changesText')],
  ]
  return (
    <PublicLayout>
      <main
        id="main-content"
        tabIndex={-1}
        data-i18n-skip
        className="inner-page document-page"
      >
        <article>
          <h1>{privacy ? t('legal.privacy.title') : t('legal.terms.title')}</h1>
          <p className="page-lede">
            {privacy ? t('legal.privacy.intro') : t('legal.terms.intro')}
          </p>
          <details className="reading-contents"><summary>{privacy ? t('legal.privacy.kicker') : t('legal.terms.kicker')}</summary><nav aria-label={privacy ? t('legal.privacy.title') : t('legal.terms.title')}>{(privacy ? privacySections : termsSections).map(([heading], index) => <a key={heading} href={`#section-${index + 1}`}>{heading}</a>)}</nav></details>
          {(privacy ? privacySections : termsSections).map(
            ([heading, text], index) => (
              <section key={heading} id={`section-${index + 1}`}>
                <h2>{heading}</h2>
                <p>{text}</p>
              </section>
            ),
          )}
        </article>
      </main>
    </PublicLayout>
  )
}

export function NotFound() {
  const { t } = useI18n()
  return (
    <PublicLayout>
      <main
        id="main-content"
        tabIndex={-1}
        data-i18n-skip
        className="inner-page not-found"
      >
        <h1>{t('website.notFound.title')}</h1>
        <p>{t('website.notFound.description')}</p>
        <InternalLink className="button button-primary" href="/">
          {t('website.notFound.back')}
        </InternalLink>
      </main>
    </PublicLayout>
  )
}
