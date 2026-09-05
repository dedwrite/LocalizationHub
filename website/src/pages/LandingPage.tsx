import { useI18n } from '@localizationhub/i18n'
import Reveal from '../components/Reveal'
import { Header, Footer } from '../components/SiteChrome'
import { InternalLink } from '../internalNavigation'
import TipCard from '../delight/TipCard'
import { FaqLocaleSecret, FridayClock } from '../delight/LittleSecrets'
import AmbientGreeting from '../delight/AmbientGreeting'
import GameMemeSecret from '../delight/GameMemeSecret'
import RtlShowcase from '../components/RtlShowcase'
import LiveEditorPreview from '../components/LiveEditorPreview'
import FormatGuide from '../components/FormatGuide'
import '../landing-experience.css'

function Feature({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: string
}) {
  return (
    <article
      className="feature"
      data-reveal="up"
      data-reveal-delay={
        number === '02' ? '80ms' : number === '03' ? '160ms' : '0ms'
      }
    >
      <span className="feature-number">{number}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  )
}

export default function Landing() {
  const { t } = useI18n()
  return (
    <>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-main"
        data-i18n-skip
      >
        <section className="hero" id="product">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" />
              {t('website.hero.eyebrowMixed')}
            </p>
            <h1>
              {t('website.hero.titleStart')}
              <br />
              <i>{t('website.hero.titleEnd')}</i>
            </h1>
            <p className="hero-description">{t('website.hero.description')}</p>
            <div className="hero-actions">
              <InternalLink className="button button-primary" href="/app/local">
                {t('website.hero.openLocal')}
              </InternalLink>
              <InternalLink className="button button-quiet" href="/download">
                {t('website.hero.downloadWindows')}
                <span>↗</span>
              </InternalLink>
            </div>
            <div
              className="hero-signals"
              aria-label={t('website.hero.characteristics')}
            >
              <span>
                <i />
                {t('website.hero.localFirst')}
              </span>
              <span>{t('website.hero.protectedTokens')}</span>
              <span>{t('website.signal.optionalCloud')}</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="preview-aura" aria-hidden="true" />
            <LiveEditorPreview />
          </div>
        </section>
        <section className="section extraction-section" id="engines">
          <div className="section-intro">
            <p className="eyebrow">{t('website.engines.kicker')}</p>
            <h2>
              {t('website.engines.titleStart')}
              <br />
              <i>{t('website.engines.titleEnd')}</i>
            </h2>
            <p>{t('website.engines.body')}</p>
          </div>
          <FormatGuide />
          <p className="section-note">
            <span className="engine-boundary">
              {t('website.extraction.readOnlyCaps')}
            </span>{' '}
            {t('website.engines.readOnlyNote')}
          </p>
        </section>
        <Reveal variant="up">
          <section className="section extraction-section" id="extraction">
            <details className="extraction-details">
              <summary>
                {t('landing.extraction.details')}
                <span aria-hidden="true">+</span>
              </summary>
              <div
                className="workflow-line extraction-flow"
                aria-label={t('website.extraction.pipeline')}
              >
                {[
                  [
                    '01',
                    t('website.extraction.gameFolder'),
                    t('website.extraction.gameFolderText'),
                  ],
                  [
                    '02',
                    t('website.extraction.scan'),
                    t('website.extraction.scanText'),
                  ],
                  [
                    '03',
                    t('website.extraction.review'),
                    t('website.extraction.reviewText'),
                  ],
                  [
                    '04',
                    t('common.labels.project'),
                    t('website.extraction.project'),
                  ],
                ].map(([n, title, text]) => (
                  <div className="workflow-step" key={n}>
                    <span>{n}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                    <small>
                      {n === '01'
                        ? t('website.extraction.input')
                        : n === '02'
                          ? t('website.extraction.scan')
                          : n === '03'
                            ? t('website.extraction.review')
                            : t('website.extraction.readyTranslate')}
                    </small>
                  </div>
                ))}
              </div>
              <p className="section-note">{t('website.extraction.safety')}</p>
            </details>
          </section>
        </Reveal>

        <Reveal variant="left">
          <section className="section context-section" id="context">
            <div className="section-intro">
              <p className="eyebrow">{t('website.context.kicker')}</p>
              <h2>
                {t('website.context.titleStart')}
                <br />
                <i>{t('website.context.titleEnd')}</i>
              </h2>
              <p>{t('website.context.description')}</p>
            </div>
            <div
              className="context-demo"
              data-i18n-skip
              aria-label={t('website.context.illustrative')}
            >
              <div className="demo-topline">
                <span>{t('website.context.demoId')}</span>
                <FridayClock hidden />
              </div>
              <div className="context-people">
                <div>
                  <small>{t('website.context.speaker')}</small>
                  <strong>{t('website.context.speakerVeyra')}</strong>
                </div>
                <div>
                  <small>{t('website.context.listener')}</small>
                  <strong>{t('website.context.listenerPlayer')}</strong>
                </div>
                <div>
                  <small>{t('website.context.scene')}</small>
                  <strong>{t('website.context.sceneGate')}</strong>
                </div>
              </div>
              <div className="demo-copy">
                <small>{t('website.context.source')}</small>
                <p lang="en" dir="ltr">
                  Hold the line, <mark dir="ltr">{'{player_name}'}</mark>. The{' '}
                  <mark dir="ltr">{'<color=#C45A3A>'}</mark>Northern Gate
                  <mark dir="ltr">{'</color>'}</mark> does not fall tonight.
                </p>
              </div>
              <div className="demo-copy demo-translation">
                <small>{t('website.context.translation')}</small>
                <p lang="ar" dir="rtl">
                  اثبت يا <mark dir="ltr">{'{player_name}'}</mark>.{' '}
                  <mark dir="ltr">{'<color=#C45A3A>'}</mark>البوابة الشمالية
                  <mark dir="ltr">{'</color>'}</mark> لا تسقط الليلة.
                </p>
              </div>
              <div className="protected-row">
                <span>{t('website.context.protected')}</span>
                <code>{'{player_name}'}</code>
                <code>{'<color=#C45A3A>'}</code>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal variant="right">
          <section className="section" id="workspace">
            <div className="section-intro">
              <p className="eyebrow">{t('website.feature.workspaceKicker')}</p>
              <h2>
                {t('website.feature.titleStart')}
                <br />
                <i>{t('website.feature.titleEnd')}</i>
              </h2>
              <p>{t('website.feature.workspaceDescription')}</p>
            </div>
            <div className="feature-grid" id="workflow">
              <Feature
                number="01"
                title={t('website.feature.translationWorkflow')}
              >
                {t('website.feature.translationWorkflowText')}
              </Feature>
              <Feature number="02" title={t('website.feature.terminology')}>
                {t('website.feature.terminologyText')}
              </Feature>
              <Feature number="03" title={t('website.feature.team')}>
                {t('website.feature.teamText')}
              </Feature>
              <Feature number="04" title={t('website.feature.productivity')}>
                {t('website.feature.productivityText')}
              </Feature>
            </div>
          </section>
        </Reveal>

        <Reveal variant="left">
          <section className="section split-section" id="cloud">
            <div className="split-label">
              <p className="eyebrow">{t('website.surface.kicker')}</p>
            </div>
            <div className="surface surface-local">
              <span className="surface-index">A</span>
              <h2>{t('website.surface.localProjects')}</h2>
              <p>{t('website.surface.localText')}</p>
              <span className="surface-tag">
                {t('website.surface.localFirstCaps')}
              </span>
            </div>
            <div className="surface surface-cloud">
              <span className="surface-index">B</span>
              <h2>{t('website.surface.cloudProjects')}</h2>
              <p>{t('website.surface.cloudText')}</p>
              <span className="surface-tag">
                {t('website.surface.optionalCloud')}
              </span>
            </div>
          </section>
        </Reveal>

        <Reveal variant="up">
          <section className="section rtl-section" id="arabic">
            <div className="section-intro">
              <p className="eyebrow">{t('website.rtl.kicker')}</p>
              <h2>
                {t('website.rtl.titleStart')}
                <br />
                <i>{t('website.rtl.titleEnd')}</i>
              </h2>
              <p>{t('website.rtl.body')}</p>
            </div>
            <RtlShowcase />
          </section>
        </Reveal>

        <aside className="privacy-brief" id="privacy">
          <div>
            <h2>
              {t('website.privacy.titleStart')} {t('website.privacy.titleEnd')}
            </h2>
            <p>{t('website.privacy.body')}</p>
          </div>
          <InternalLink href="/privacy">
            {t('landing.privacy.details')} <span aria-hidden="true">↗</span>
          </InternalLink>
        </aside>

        <section className="field-notes" data-i18n-skip>
          <div>
            <span className="field-notes-kicker">{t('delight.notes')}</span>
            <h2>{t('delight.notesTitle')}</h2>
            <p>{t('delight.notesBody')}</p>
            <AmbientGreeting />
          </div>
          <TipCard context="landing" />
        </section>

        <Reveal variant="fade">
          <section className="section faq-section" id="faq">
            <div className="section-intro">
              <p className="eyebrow">{t('website.faq.kicker')}</p>
              <h2>
                {t('website.faq.titleStart')}
                <br />
                <i>{t('website.faq.titleEnd')}</i>
                <FaqLocaleSecret />
              </h2>
            </div>
            <div className="faq-list">
              {[
                [t('website.faq.freeQuestion'), t('website.faq.freeAnswer')],
                [
                  t('website.faq.accountQuestion'),
                  t('website.faq.accountAnswer'),
                ],
                [t('website.faq.localQuestion'), t('website.faq.localAnswer')],
                [t('website.faq.cloudQuestion'), t('website.faq.cloudAnswer')],
              ].map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <span>+</span>
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>
        <section className="closing-invite">
          <div>
            <h2>{t('landing.closing.title')}</h2>
            <p>{t('landing.closing.body')}</p>
          </div>
          <InternalLink className="button button-primary" href="/app/local">
            {t('website.hero.openLocal')} <span aria-hidden="true">↗</span>
          </InternalLink>
        </section>
      </main>
      <GameMemeSecret />
      <Footer />
    </>
  )
}
