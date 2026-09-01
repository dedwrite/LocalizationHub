import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { site } from './config/site'
import useScrollReveal from './hooks/useScrollReveal'
import usePointerDepth from './hooks/usePointerDepth'
import MotionDebugBadge from './components/MotionDebugBadge'
import Reveal from './components/Reveal'
import AppWorkspace from './AppWorkspace'
import LocalWorkspace from './LocalWorkspace'
import AdminConsole from './AdminConsole'
import { InternalLink } from './internalNavigation'
import { allowHistoryNavigation } from './navigation'
import LhRadio from './lhRadio/LhRadio'
import TipCard from './delight/TipCard'
import { FooterSecret, FridayClock } from './delight/LittleSecrets'
import './styles.css'
import './experience-polish.css'
import './workspace-deep-polish.css'
import './visual-refinement.css'
import './delight/delight.css'

const nav = [
  ['Product', '/#product'], ['Workflow', '/#workflow'], ['Cloud', '/#cloud'], ['Formats', '/#formats'], ['Web App', '/app'], ['Download', '/download'], ['GitHub', site.repositoryUrl],
]

function Header() {
  const motionState = useScrollReveal()
  return <><header className="site-header"><InternalLink className="brand" href="/"><img className="brand-icon" src="/localizationhub-logo.jpg" alt="" /><span>{site.name}</span></InternalLink><nav className="main-nav">{nav.map(([label, href]) => <InternalLink key={label} href={href}>{label}</InternalLink>)}</nav><InternalLink className="header-cta" href="/app">Open Web App</InternalLink></header><MotionDebugBadge state={motionState} /></>
}

function EditorPreview() {
  const { locale, setLocale, t } = useI18n()
  const pointerRef = useRef<HTMLDivElement>(null)
  usePointerDepth(pointerRef)

  return <div className="editor-reveal-shell" data-reveal="right"><div className="preview-controls" role="group" aria-label={t('landing.previewLanguage')}><span>{t('landing.previewLive')}</span><div data-i18n-skip><button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>{t('common.language.english')}</button><button type="button" lang="ar" aria-pressed={locale === 'ar'} onClick={() => setLocale('ar')}>{t('common.language.arabic')}</button></div></div><div ref={pointerRef} className="editor-depth-shell"><div className="editor-preview" aria-label="LocalizationHub editor preview"><aside className="preview-sidebar"><div className="preview-sidebar-top"><span>ENTRIES</span><span>12 / 48</span></div><div className="preview-search">Search keys or text...</div>{['menu.start', 'menu.settings', 'quest.accept', 'item.sword', 'dialogue.greeting'].map((key, index) => <div className={`preview-entry ${index === 1 ? 'selected' : ''}`} key={key}><i className={`dot dot-${index % 4}`} /><div><strong>{key}</strong><small>{['Start game', 'Settings', 'Accept quest', 'Iron sword', 'Welcome back'][index]}</small></div></div>)}</aside><main className="preview-main"><div className="preview-breadcrumb">menu.settings <span>UI</span></div><div className="preview-source"><label>Source</label><p>Adjust the game settings</p></div><div className="preview-translation"><div className="translation-label"><label>Translation</label><span className="status-pill">Needs Review</span></div><p>ضبط إعدادات اللعبة</p><span className="cursor" /></div><div className="preview-footer"><span>Protected tokens · 0 errors</span><span>Entry 02 of 48</span></div></main><aside className="preview-inspector"><div className="inspector-title">Inspector <span>•••</span></div><div className="inspector-tabs"><b>Workflow</b><span>Quality</span><span>Comments</span></div><div className="inspector-block"><small>STATUS</small><strong>Needs Review</strong><em>Assigned to samira</em></div><div className="inspector-block"><small>TAGS</small><div className="chips"><span>UI</span><span>Settings</span></div></div><div className="inspector-comment"><span>COMMENT · 2</span><p>Check the tone against the glossary.</p></div></aside></div></div></div>
}

function Feature({ number, title, children }: { number: string; title: string; children: string }) { return <article className="feature" data-reveal="up" data-reveal-delay={number === '02' ? '80ms' : number === '03' ? '160ms' : '0ms'}><span className="feature-number">{number}</span><h3>{title}</h3><p>{children}</p></article> }

const engineSignals = [
  { name: 'Godot', formats: 'PCK · PO · CSV · INKB', note: 'Project files, dialogue, and locale-aware resources.' },
  { name: 'Unreal', formats: 'LOCRES · LOCMETA · PAK / IOSTORE', note: 'Verified localization containers; some assets remain partial.' },
  { name: 'Unity', formats: 'TEXTASSET · LOCALIZATION · MONOBEHAVIOUR', note: 'Structured assets where type information remains available.' },
]

function EngineCard({ engine, index }: { engine: (typeof engineSignals)[number]; index: number }) {
  return <article className="engine-card" data-reveal="up" data-reveal-delay={`${index * 70}ms`}><span className="engine-index">0{index + 1}</span><div><h3>{engine.name}</h3><strong>{engine.formats}</strong><p>{engine.note}</p></div><span className="engine-boundary">READ-ONLY EXTRACTION</span></article>
}

function Landing() {
  const { t } = useI18n()
  return <><Header /><main className="landing-main">
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-line" /> v{site.version} · {site.releaseTitle}</p>
        <h1>Localization work,<br /><i>without the mess.</i></h1>
        <p className="hero-description">A focused translation workspace for the files you already have — and, new in v0.7, read-only extraction from Godot, Unreal, and Unity game folders. Translate, review, manage terminology, and collaborate when you need to.</p>
        <div className="hero-actions"><a className="button button-primary" href={site.releaseUrl}>Download for Windows <span>↗</span></a><a className="button button-quiet" href={site.repositoryUrl}>View on GitHub <span>↗</span></a></div>
        <div className="hero-signals" aria-label="Product characteristics"><span><i /> Local-first</span><span>Read-only extraction</span><span>Protected tokens</span></div>
      </div>
      <div className="hero-visual"><div className="visual-caption"><span className="caption-dot" /> structured localization workspace</div><div className="preview-aura" aria-hidden="true" /><Reveal variant="right"><EditorPreview /></Reveal></div>
    </section>
    <section className="signal-strip"><span>BUILT FOR THE WORK BETWEEN <b>IMPORT</b> AND <b>SHIP</b></span><span>JSON · CSV · PO · GAME FOLDERS</span><span>WINDOWS X64</span></section>
    <section className="field-notes" data-i18n-skip><div><span className="field-notes-kicker">{t('delight.notes')}</span><h2>{t('delight.notesTitle')}</h2><p>{t('delight.notesBody')}</p></div><TipCard context="landing" /></section>

    <Reveal variant="up"><section className="section extraction-section" id="extraction">
      <div className="section-intro"><p className="eyebrow">NEW IN v0.7 · GAME TEXT EXTRACTION</p><h2>Start from a<br /><i>game folder.</i></h2><p>Point LocalizationHub at a Godot, Unreal, or Unity project and read its text out — read-only — into a structured, reviewable project.</p></div>
      <div className="workflow-line extraction-flow" aria-label="Game-folder extraction pipeline">{[['01', 'Game folder', 'Choose a supported engine project folder.'], ['02', 'Scan', 'Detect the engine and discover localization resources.'], ['03', 'Extraction review', 'Review, filter, and map context before anything is created.'], ['04', 'Project', 'Create a LocalizationHub Project ready to translate.']].map(([n, title, text]) => <div className="workflow-step" key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p><small>{n === '01' ? 'INPUT' : n === '04' ? 'READY TO TRANSLATE' : 'READ ONLY'}</small></div>)}</div>
      <div className="engine-grid">{engineSignals.map((engine, index) => <EngineCard key={engine.name} engine={engine} index={index} />)}</div>
      <p className="section-note">No original-game-file modification · compatibility remains explicit where deep binary formats are partial.</p>
    </section></Reveal>

    <Reveal variant="left"><section className="section context-section" id="context">
      <div className="section-intro"><p className="eyebrow">CONTEXT / SYNTAX AWARE</p><h2>The words arrive<br /><i>with their guardrails.</i></h2><p>When structure is available, LocalizationHub keeps dialogue context close and checks protected syntax before export.</p></div>
      <div className="context-demo" aria-label="Illustrative localization entry">
        <div className="demo-topline"><span>ILLUSTRATIVE ENTRY / hotfix.friday.1159</span><span className="demo-status"><i /> TOKENS VALID</span></div>
        <div className="context-people"><div><small>SPEAKER</small><strong>Developer</strong></div><div><small>LISTENER</small><strong>Translator</strong></div><div><small>SCENE</small><strong><FridayClock /></strong></div></div>
        <div className="demo-copy"><small>SOURCE</small><p>"Quick hotfix. Only <mark>{'{new_strings}'}</mark> new lines before <mark>{'<color=#A86BFF>'}</mark>midnight<mark>{'</color>'}</mark>."</p></div>
        <div className="demo-copy demo-translation"><small>TRANSLATION</small><p lang="ar" dir="rtl">"هوتفكس بسيط. بس <mark>{'{new_strings}'}</mark> سطر جديد قبل <mark>{'<color=#A86BFF>'}</mark>منتصف الليل<mark>{'</color>'}</mark>."</p></div>
        <div className="protected-row"><span>PROTECTED</span><code>{'{new_strings}'}</code><code>{'<color=#A86BFF>'}</code><code>{'</color>'}</code></div>
      </div>
    </section></Reveal>

    <Reveal variant="left"><section className="section features" id="product"><div className="section-intro"><p className="eyebrow">01 / THE WORKSPACE</p><h2>Everything that keeps<br /><i>translation moving.</i></h2><p>Small, deliberate tools for the work translators and reviewers actually do.</p></div><div className="feature-grid"><Feature number="01" title="Translation workflow">Move work from Draft to Translated, Needs Review, and Approved with clear editorial states.</Feature><Feature number="02" title="Terminology & quality">Keep preferred terms close, catch forbidden translations, protect tokens, and use Translation Memory as a suggestion.</Feature><Feature number="03" title="Team collaboration">Assign entries, discuss context, inspect activity, restore earlier text, and resolve conflicts without losing control.</Feature><Feature number="04" title="Project productivity">Search by status or tag, work in bulk, measure progress, and keep the project readable at scale.</Feature></div></section></Reveal>
    <Reveal variant="right"><section className="section workflow-section" id="workflow"><div className="section-intro"><p className="eyebrow">02 / A CLEAN HANDOFF</p><h2>From file to<br /><i>finished words.</i></h2><p>LocalizationHub works with localization files that have already been obtained. Your source structure stays visible and intact.</p></div><div className="workflow-line">{[['01', 'Import', 'Open the file you already have.'], ['02', 'Translate', 'Write with context, tokens, and terminology close by.'], ['03', 'Review', 'Send entries to review and resolve quality issues.'], ['04', 'Approve', 'Make editorial decisions explicit.'], ['05', 'Export', 'Ship the translated file in its working format.']].map(([n, title, text]) => <div className="workflow-step" key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></div>)}</div></section></Reveal>
    <Reveal variant="left"><section className="section split-section" id="cloud"><div className="split-label"><p className="eyebrow">03 / CHOOSE YOUR SURFACE</p></div><div className="surface surface-local"><span className="surface-index">A</span><h2>Local Projects</h2><p>Your files can stay on your machine. Work without an account, without a connection, and without handing your project to a service.</p><span className="surface-tag">LOCAL-FIRST</span></div><div className="surface surface-cloud"><span className="surface-index">B</span><h2>Cloud Projects</h2><p>Bring in your team when it helps. Owner, Editor, and Viewer roles keep collaboration useful and bounded.</p><span className="surface-tag">OPTIONAL CLOUD</span></div></section></Reveal>
    <Reveal variant="right"><section className="section formats-section" id="formats"><div className="section-intro"><p className="eyebrow">04 / OPEN STRUCTURES</p><h2>Bring your format.<br /><i>Keep your structure.</i></h2></div><div className="format-list">{site.supportedFormats.map((format, index) => <div className="format-row" key={format}><span>0{index + 1}</span><strong>{format}</strong><small>parse · edit · export</small></div>)}</div></section></Reveal>
    <Reveal variant="up"><section className="section release-section" id="download"><div className="release-kicker">LATEST RELEASE / {site.version}</div><h2>Web<br /><i>Delight</i></h2><p>Context-aware bilingual tips, honest resume cards, and quiet discoveries make Local, Cloud, and the translation workspace more useful without compromising privacy or LH Radio.</p><a className="button button-primary" href={site.releaseUrl}>Get LocalizationHub v{site.version} <span>↗</span></a><small>Windows x64 · Installer available on GitHub Releases</small></section></Reveal>
    <Reveal variant="fade"><section className="section faq-section"><div className="section-intro"><p className="eyebrow">05 / GOOD QUESTIONS</p><h2>Before you<br /><i>start translating.</i></h2></div><div className="faq-list">{[['Is LocalizationHub free?', 'The current v0.9.3 release is available through GitHub Releases. Local Projects work without an account.'], ['Do I need an account?', 'No. Local Projects work without an account. An account is only needed for Cloud Projects and online collaboration.'], ['What formats are supported?', 'JSON, CSV, gettext PO, and LocalizationHub Project files (.lhproj) — plus read-only extraction from Godot, Unreal, and Unity game folders.'], ['Does LocalizationHub extract files from games?', 'Game Text Extraction was introduced in v0.7 as read-only extraction from Godot, Unreal, and Unity game folders. Some deep binary formats remain partial; see the engine compatibility notes.'], ['What is a Cloud Project?', 'An optional shared project with persistent workflow data, assignments, comments, activity, and Owner, Editor, and Viewer permissions.']].map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section></Reveal>
  </main><Footer /></>
}

function DownloadPage() { return <><Header /><main className="inner-page download-page"><p className="eyebrow">RELEASE / {site.version}</p><div className="download-layout"><div><h1>LocalizationHub<br /><i>{site.releaseTitle}</i></h1><p className="page-lede">A focused Windows workspace for translating, reviewing, and managing the localization files you already have.</p><a className="button button-primary" href={site.releaseUrl}>Download from GitHub <span>↗</span></a><a className="button button-quiet" href={site.releaseUrl}>View release notes <span>↗</span></a></div><div className="download-panel"><div className="panel-mark"><img src="/localizationhub-logo.jpg" alt="" /></div><span className="panel-kicker">CURRENT STABLE RELEASE</span><h2>v{site.version}</h2><div className="download-fact"><span>Installer</span><strong>LocalizationHub_0.9.3_x64-setup.exe</strong></div><div className="download-fact"><span>Platform</span><strong>Windows x64</strong></div><div className="download-fact"><span>Works with</span><strong>Local Projects · Optional Cloud Projects</strong></div></div></div></main><Footer /></> }
function DocumentPage({ kind }: { kind: 'privacy' | 'terms' }) { const privacy = kind === 'privacy'; return <><Header /><main className="inner-page document-page"><p className="eyebrow">LOCALIZATIONHUB / {privacy ? 'PRIVACY' : 'TERMS'}</p><article><h1>{privacy ? 'Privacy, in plain language.' : 'Terms for using the workspace.'}</h1><p className="page-lede">{privacy ? 'This preliminary overview describes what the current product does with your files and account data.' : 'These initial product terms describe practical expectations for using LocalizationHub.'}</p>{(privacy ? [['Local Projects', 'Local Projects stay on your machine unless you explicitly choose to use a Cloud Project or an online collaboration feature.'], ['Cloud Projects', 'Cloud Projects use authenticated accounts and PostgreSQL-backed project storage. Project members can access data according to their Owner, Editor, or Viewer role.'], ['Accounts', 'Cloud features use account details needed for authentication, sessions, membership, and email verification.'], ['Project data', 'LocalizationHub uses project data to provide the editing, persistence, collaboration, and history features you request.'], ['API keys', 'Machine translation API keys are kept in application memory and are not stored in project files, localization files, application configuration, local storage, or logs.'], ['Third-party infrastructure', 'The public release is distributed through GitHub Releases. Cloud infrastructure and email delivery may change as the product evolves.'], ['Music and third-party embeds', 'LH Radio streams audio tracks that are uploaded and administered directly by LocalizationHub. LocalizationHub does not build tracking around the player and does not receive any third-party account details.'], ['Future updates', 'This page is a practical starting point and may be updated as the website and service mature.']] : [['Using LocalizationHub', 'Use the editor to work with localization files you already have. Do not use the product to violate the rights of others or to interfere with systems you do not control.'], ['Local files and backups', 'Keep backups of important localization files and projects. Local Projects are stored on your machine and remain your responsibility.'], ['Cloud Projects', 'Cloud access is permission-based. Respect project roles and the work of other collaborators.'], ['Accounts', 'Keep your account credentials private and use accurate information when creating an account.'], ['Software availability', 'Features and availability may change while LocalizationHub continues to develop.'], ['Releases and updates', 'Download releases from the official repository and review release notes before updating.'], ['Changes to these terms', 'These initial terms may be revised as the product and public website develop.']]).map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}</article></main><Footer /></> }
function NotFound() { return <><Header /><main className="inner-page not-found"><p className="eyebrow">404 / ENTRY NOT FOUND</p><h1>Page not found.</h1><p>The route you requested does not exist.</p><InternalLink className="button button-primary" href="/">Back to LocalizationHub</InternalLink></main><Footer /></> }
function Footer() { return <footer><InternalLink className="brand" href="/"><img className="brand-icon" src="/localizationhub-logo.jpg" alt="" /><span>{site.name}</span></InternalLink><span>v{site.version} · {site.releaseTitle}</span><div><a href={site.repositoryUrl}>GitHub</a><a href={site.releaseUrl}>Releases</a><span className="muted">Documentation / upcoming</span><a className="creator-signature" href="https://dedwrite.xyz/" target="_blank" rel="noopener noreferrer">DEDWRITE</a><FooterSecret /></div></footer> }
export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => { const handle = (event: PopStateEvent) => { if (allowHistoryNavigation(event)) setPath(window.location.pathname) }; window.addEventListener('popstate', handle); return () => window.removeEventListener('popstate', handle) }, [])
  const suppressRadio = path === '/app/admin' || path.startsWith('/app/admin/')
  return <><RoutedPage path={path} />{!suppressRadio && <LhRadio />}</>
}

function RoutedPage({ path }: { path: string }) {
  if (path === '/app/local') return <LocalWorkspace />
  if (path === '/app/admin' || path.startsWith('/app/admin/')) return <AdminConsole />
  if (path.startsWith('/app')) return <AppWorkspace />
  if (path === '/download') return <DownloadPage />
  if (path === '/privacy') return <DocumentPage kind="privacy" />
  if (path === '/terms') return <DocumentPage kind="terms" />
  if (path !== '/') return <NotFound />
  return <Landing />
}
