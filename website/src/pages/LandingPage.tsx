import { useRef } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { site } from '../config/site'
import usePointerDepth from '../hooks/usePointerDepth'
import Reveal from '../components/Reveal'
import { Header, Footer } from '../components/SiteChrome'
import { InternalLink } from '../internalNavigation'
import TipCard from '../delight/TipCard'
import { FaqLocaleSecret, FridayClock } from '../delight/LittleSecrets'
import AmbientGreeting from '../delight/AmbientGreeting'
import GameMemeSecret from '../delight/GameMemeSecret'
import RtlShowcase from '../components/RtlShowcase'

function EditorPreview() {
  const { locale, setLocale, t } = useI18n()
  const pointerRef = useRef<HTMLDivElement>(null)
  usePointerDepth(pointerRef)
  return (
    <div className="editor-reveal-shell" data-reveal="right">
      <div
        className="preview-controls"
        role="group"
        aria-label={t('landing.previewLanguage')}
      >
        <span>{t('landing.previewLive')}</span>
        <div data-i18n-skip>
          <button
            type="button"
            lang="en"
            aria-pressed={locale === 'en'}
            onClick={() => setLocale('en')}
          >
            {t('common.language.english')}
          </button>
          <button
            type="button"
            lang="ar"
            aria-pressed={locale === 'ar'}
            onClick={() => setLocale('ar')}
          >
            {t('common.language.arabic')}
          </button>
        </div>
      </div>
      <div ref={pointerRef} className="editor-depth-shell">
        <div
          className="editor-preview"
          data-i18n-skip
          aria-label={t('website.preview.label')}
        >
          <aside className="preview-sidebar">
            <div className="preview-sidebar-top">
              <span>{t('projects.entriesCaps')}</span>
              <bdi>3 / 48</bdi>
            </div>
            <div className="preview-search">
              {t('desktop.search.placeholder')}
            </div>
            {['quest.northern_gate', 'ui.menu.start', 'npc.veyra.line'].map(
              (key, index) => (
                <div
                  className={`preview-entry ${index === 0 ? 'selected' : ''}`}
                  key={key}
                >
                  <i className={`dot dot-${index % 4}`} />
                  <div>
                    <strong dir="ltr">{key}</strong>
                    <small lang="en" dir="ltr">
                      {['Hold the line.', 'Start game', 'Gate watch'][index]}
                    </small>
                  </div>
                </div>
              ),
            )}
          </aside>
          <div className="preview-main">
            <div className="preview-breadcrumb">
              <bdi>quest.northern_gate</bdi>{' '}
              <span>{t('website.preview.dialogue')}</span>
            </div>
            <div className="preview-source">
              <label>{t('workspace.source')}</label>
              <p lang="en" dir="ltr" data-i18n-content>
                Hold the line, {'{player_name}'}.
              </p>
            </div>
            <div className="preview-translation">
              <div className="translation-label">
                <label>{t('workspace.translation')}</label>
                <span className="status-pill">
                  {t('workspace.needsReview')}
                </span>
              </div>
              <p lang="ar" dir="rtl" data-i18n-content>
                اثبت، {'{player_name}'}.
              </p>
              <span className="cursor" />
            </div>
            <div className="preview-footer">
              <span>{t('website.preview.tokens')}</span>
              <span>
                {t('website.preview.position', { current: 1, total: 48 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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

function engineSignals(t: ReturnType<typeof useI18n>['t']) {
  return [
    {
      name: 'Godot',
      headline: t('website.engine.godotHeadline'),
      proof: 'PCK · PO · CSV · INKB',
    },
    {
      name: 'Unreal',
      headline: t('website.engine.unrealHeadline'),
      proof: 'LOCRES · LOCMETA · PAK / IOSTORE',
    },
    {
      name: 'Unity',
      headline: t('website.engine.unityHeadline'),
      proof: 'TEXTASSET · LOCALIZATION · MONOBEHAVIOUR',
    },
  ]
}

function EngineCard({
  engine,
  index,
}: {
  engine: ReturnType<typeof engineSignals>[number]
  index: number
}) {
  return (
    <article
      className="engine-card"
      data-reveal="up"
      data-reveal-delay={`${index * 70}ms`}
    >
      <span className="engine-index">0{index + 1}</span>
      <div>
        <h3>{engine.headline}</h3>
        <span className="engine-proof">
          {engine.name} · {engine.proof}
        </span>
      </div>
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
              <a className="button button-quiet" href={site.releaseUrl}>
                {t('website.hero.downloadWindows')}
                <span>↗</span>
              </a>
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
            <div className="visual-caption">
              <span className="caption-dot" />
              {t('website.hero.workspace')}
            </div>
            <div className="preview-aura" aria-hidden="true" />
            <Reveal variant="right">
              <EditorPreview />
            </Reveal>
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
          <div className="engine-grid">
            {engineSignals(t).map((engine, index) => (
              <EngineCard key={engine.name} engine={engine} index={index} />
            ))}
          </div>
          <p className="section-note">
            <span className="engine-boundary">
              {t('website.extraction.readOnlyCaps')}
            </span>{' '}
            {t('website.engines.readOnlyNote')}
          </p>
        </section>
        <section className="signal-strip" id="formats">
          <span>{t('website.formats.filesStrip')}</span>
          <span>JSON · CSV · PO · .lhproj</span>
          <span>{t('website.formats.gamesStrip')}</span>
          <span>GODOT · UNREAL · UNITY</span>
        </section>

        <Reveal variant="up">
          <section className="section extraction-section" id="extraction">
            <div className="section-intro">
              <p className="eyebrow">{t('website.extraction.new')}</p>
              <h2>
                {t('website.extraction.titleStart')}
                <br />
                <i>{t('website.extraction.titleEnd')}</i>
              </h2>
              <p>{t('website.extraction.description')}</p>
            </div>
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
            <div className="feature-grid">
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

        <section
          className="workflow-strip"
          id="workflow"
          aria-label={t('website.feature.translationWorkflow')}
        >
          <span>
            <b>{t('website.workflow.importTitle')}</b>{' '}
            {t('website.workflow.stripImport')}
          </span>
          <span>
            <b>{t('website.workflow.translateTitle')}</b>{' '}
            {t('website.workflow.stripTranslate')}
          </span>
          <span>
            <b>{t('website.workflow.reviewTitle')}</b>{' '}
            {t('website.workflow.stripReview')}
          </span>
          <span>
            <b>{t('local.export')}</b> {t('website.workflow.stripExport')}
          </span>
        </section>

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

        <Reveal variant="right">
          <section className="section" id="privacy">
            <div className="section-intro">
              <p className="eyebrow">{t('website.privacy.kicker')}</p>
              <h2>
                {t('website.privacy.titleStart')}
                <br />
                <i>{t('website.privacy.titleEnd')}</i>
              </h2>
              <p>{t('website.privacy.body')}</p>
            </div>
          </section>
        </Reveal>

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
                [t('website.faq.openQuestion'), t('website.faq.openAnswer')],
                [
                  t('website.faq.extractQuestion'),
                  t('website.faq.extractAnswer'),
                ],
                [
                  t('website.faq.arabicQuestion'),
                  t('website.faq.arabicAnswer'),
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
      </main>
      <GameMemeSecret />
      <Footer />
    </>
  )
}
