import { useEffect, useRef, useState } from 'react'
import { LanguageSwitcher, useI18n } from '@localizationhub/i18n'
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
import { FaqLocaleSecret, FooterSecret, FridayClock } from './delight/LittleSecrets'
import AmbientGreeting from './delight/AmbientGreeting'
import CommandCenter, { openCommandCenter } from './delight/CommandCenter'
import GameMemeSecret from './delight/GameMemeSecret'
import RtlShowcase from './components/RtlShowcase'
import './styles.css'
import './experience-polish.css'
import './workspace-deep-polish.css'
import './visual-refinement.css'
import './marketing-atmosphere.css'
import './delight/delight.css'
import './delight/quiet-polish.css'

const nav = [
  ['Product', '/#product'],
  ['Web App', '/app'],
  ['Download', '/download'],
  ['GitHub', site.repositoryUrl],
]

function Header() {
  const motionState = useScrollReveal()
  const { t } = useI18n()
  return <><header className="site-header"><InternalLink className="brand" href="/"><img className="brand-icon" src="/localizationhub-logo.jpg" alt="" /><span>{site.name}</span></InternalLink><nav className="main-nav">{nav.map(([label, href]) => <InternalLink key={label} href={href}>{label}</InternalLink>)}</nav><button type="button" className="command-launcher site-command-launcher" onClick={() => openCommandCenter()} aria-label={t('delight.command.open')}><span>{t('delight.command.quick')}</span><kbd>⌘K</kbd></button><InternalLink className="header-cta" href="/app/local">Open Local Workspace</InternalLink></header><MotionDebugBadge state={motionState} /></>
}

function EditorPreview() {
  const { locale, setLocale, t } = useI18n()
  const pointerRef = useRef<HTMLDivElement>(null)
  usePointerDepth(pointerRef)
  return <div className="editor-reveal-shell" data-reveal="right"><div className="preview-controls" role="group" aria-label={t('landing.previewLanguage')}><span>{t('landing.previewLive')}</span><div data-i18n-skip><button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>{t('common.language.english')}</button><button type="button" lang="ar" aria-pressed={locale === 'ar'} onClick={() => setLocale('ar')}>{t('common.language.arabic')}</button></div></div><div ref={pointerRef} className="editor-depth-shell"><div className="editor-preview" data-i18n-skip aria-label="LocalizationHub editor preview"><aside className="preview-sidebar"><div className="preview-sidebar-top"><span>ENTRIES</span><span>3 / 48</span></div><div className="preview-search">Search keys or text...</div>{['quest.northern_gate', 'ui.menu.start', 'npc.veyra.line'].map((key, index) => <div className={`preview-entry ${index === 0 ? 'selected' : ''}`} key={key}><i className={`dot dot-${index % 4}`} /><div><strong>{key}</strong><small>{['Hold the line.', 'Start game', 'Gate watch'][index]}</small></div></div>)}</aside><main className="preview-main"><div className="preview-breadcrumb">quest.northern_gate <span>DIALOGUE</span></div><div className="preview-source"><label>Source</label><p>Hold the line, {'{player_name}'}.</p></div><div className="preview-translation"><div className="translation-label"><label>Translation</label><span className="status-pill">Needs Review</span></div><p>اثبت، {'{player_name}'}.</p><span className="cursor" /></div><div className="preview-footer"><span>Protected tokens · 0 errors</span><span>Entry 01 of 48</span></div></main></div></div></div>
}

function Feature({ number, title, children }: { number: string; title: string; children: string }) {
  return <article className="feature" data-reveal="up" data-reveal-delay={number === '02' ? '80ms' : number === '03' ? '160ms' : '0ms'}><span className="feature-number">{number}</span><h3>{title}</h3><p>{children}</p></article>
}

const engineSignals = [
  { name: 'Godot', headline: 'Scenes, dialogue, and locale resources.', proof: 'PCK · PO · CSV · INKB' },
  { name: 'Unreal', headline: 'Localization containers you can review.', proof: 'LOCRES · LOCMETA · PAK / IOSTORE' },
  { name: 'Unity', headline: 'Structured assets when type data is present.', proof: 'TEXTASSET · LOCALIZATION · MONOBEHAVIOUR' },
]

function EngineCard({ engine, index }: { engine: (typeof engineSignals)[number]; index: number }) {
  return <article className="engine-card" data-reveal="up" data-reveal-delay={`${index * 70}ms`}><span className="engine-index">0{index + 1}</span><div><h3>{engine.headline}</h3><span className="engine-proof">{engine.name} · {engine.proof}</span></div></article>
}


function Landing() {
  const { t } = useI18n()
  return <><Header /><main className="landing-main">
    <section className="hero" id="product">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-line" /> Game localization · local-first</p>
        <h1>Game localization<br /><i>that stays on your machine.</i></h1>
        <p className="hero-description">A local-first workspace for Godot, Unreal, and Unity game text — and for JSON, CSV, and gettext PO files. Translate, review, protect tokens, and collaborate only when you choose to.</p>
        <div className="hero-actions"><InternalLink className="button button-primary" href="/app/local">Open Local Workspace</InternalLink><a className="button button-quiet" href={site.releaseUrl}>Download for Windows <span>↗</span></a></div>
        <div className="hero-signals" aria-label="Product characteristics"><span><i /> Local-first</span><span>Protected tokens</span><span>Optional cloud</span></div>
      </div>
      <div className="hero-visual"><div className="visual-caption"><span className="caption-dot" /> structured localization workspace</div><div className="preview-aura" aria-hidden="true" /><Reveal variant="right"><EditorPreview /></Reveal></div>
    </section>
    <section className="section extraction-section" id="engines">
      <div className="section-intro"><p className="eyebrow">GAMES FIRST</p><h2>Godot, Unreal, and Unity<br /><i>then JSON, CSV, and PO.</i></h2><p>Scan a game project folder, or open a localization file you already have.</p></div>
      <div className="engine-grid">{engineSignals.map((engine, index) => <EngineCard key={engine.name} engine={engine} index={index} />)}</div>
      <p className="section-note"><span className="engine-boundary">READ-ONLY EXTRACTION</span> Game folders are scanned and copied into a LocalizationHub project. Original game files are not modified.</p>
    </section>
    <section className="signal-strip" id="formats"><span>FILES · parse · edit · export</span><span>JSON · CSV · PO · .lhproj</span><span>GAME PROJECTS · scan · extract · review</span><span>GODOT · UNREAL · UNITY</span></section>

    <Reveal variant="up"><section className="section extraction-section" id="extraction">
      <div className="section-intro"><p className="eyebrow">GAME TEXT EXTRACTION</p><h2>Start from a<br /><i>game folder.</i></h2><p>Point LocalizationHub at a Godot, Unreal, or Unity project and read its text out into a structured, reviewable project.</p></div>
      <div className="workflow-line extraction-flow" aria-label="Game-folder extraction pipeline">{[['01', 'Game folder', 'Choose a supported engine project folder.'], ['02', 'Scan', 'Detect the engine and discover localization resources.'], ['03', 'Extraction review', 'Review, filter, and map context before anything is created.'], ['04', 'Project', 'Create a LocalizationHub Project ready to translate.']].map(([n, title, text]) => <div className="workflow-step" key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p><small>{n === '01' ? 'INPUT' : n === '02' ? 'SCAN' : n === '03' ? 'REVIEW' : 'READY TO TRANSLATE'}</small></div>)}</div>
      <p className="section-note">Compatibility remains explicit where deep binary formats are partial.</p>
    </section></Reveal>

    <Reveal variant="left"><section className="section context-section" id="context">
      <div className="section-intro"><p className="eyebrow">CONTEXT / SYNTAX AWARE</p><h2>The words arrive<br /><i>with their guardrails.</i></h2><p>When structure is available, LocalizationHub keeps dialogue context close and checks protected syntax before export.</p></div>
      <div className="context-demo" data-i18n-skip aria-label="Illustrative localization entry">
        <div className="demo-topline"><span>ILLUSTRATIVE ENTRY / quest.northern_gate.greeting</span><FridayClock hidden /></div>
        <div className="context-people"><div><small>SPEAKER</small><strong>Captain Veyra</strong></div><div><small>LISTENER</small><strong>Player</strong></div><div><small>SCENE</small><strong>Northern Gate</strong></div></div>
        <div className="demo-copy"><small>SOURCE</small><p>Hold the line, <mark>{'{player_name}'}</mark>. The <mark>{'<color=#C45A3A>'}</mark>Northern Gate<mark>{'</color>'}</mark> does not fall tonight.</p></div>
        <div className="demo-copy demo-translation"><small>TRANSLATION</small><p lang="ar" dir="rtl">اثبت يا <mark>{'{player_name}'}</mark>. <mark>{'<color=#C45A3A>'}</mark>البوابة الشمالية<mark>{'</color>'}</mark> لا تسقط الليلة.</p></div>
        <div className="protected-row"><span>PROTECTED</span><code>{'{player_name}'}</code><code>{'<color=#C45A3A>'}</code></div>
      </div>
    </section></Reveal>

    <Reveal variant="right"><section className="section" id="workspace">
      <div className="section-intro"><p className="eyebrow">01 / THE WORKSPACE</p><h2>Everything that keeps<br /><i>translation moving.</i></h2><p>Small, deliberate tools for the work translators and reviewers actually do.</p></div>
      <div className="feature-grid">
        <Feature number="01" title="Translation workflow">Move work from Draft to Translated, Needs Review, and Approved with clear editorial states.</Feature>
        <Feature number="02" title="Terminology & quality">Keep preferred terms close, catch forbidden translations, protect tokens, and use Translation Memory as a suggestion.</Feature>
        <Feature number="03" title="Team collaboration">Assign entries, discuss context, inspect activity, restore earlier text, and resolve conflicts without losing control.</Feature>
        <Feature number="04" title="Find, filter, and finish">Search by status or tag, work in bulk, measure progress, and keep the project readable at scale.</Feature>
      </div>
    </section></Reveal>

    <section className="workflow-strip" id="workflow" aria-label="Translation workflow"><span><b>Import</b> the file or extracted project</span><span><b>Translate</b> with context and tokens nearby</span><span><b>Review</b> and approve</span><span><b>Export</b> in the working format</span></section>

    <Reveal variant="left"><section className="section split-section" id="cloud">
      <div className="split-label"><p className="eyebrow">LOCAL OR CLOUD</p></div>
      <div className="surface surface-local"><span className="surface-index">A</span><h2>Local Projects</h2><p>Your files can stay on your machine. Work without an account, without a connection, and without handing your project to a service. Keep backups of important files; local copies remain your responsibility.</p><span className="surface-tag">LOCAL-FIRST</span></div>
      <div className="surface surface-cloud"><span className="surface-index">B</span><h2>Cloud Projects</h2><p>Bring in your team when it helps. Owner, Editor, and Viewer roles keep collaboration useful and bounded.</p><span className="surface-tag">OPTIONAL CLOUD</span></div>
    </section></Reveal>

    <Reveal variant="up"><section className="section rtl-section" id="arabic">
      <div className="section-intro"><p className="eyebrow">ARABIC / RTL</p><h2>Arabic is a first-class<br /><i>editing direction.</i></h2><p>The public site, Web App, and translation fields follow the interface language. Switch to Arabic to work right-to-left without a separate product mode.</p></div>
      <RtlShowcase />
    </section></Reveal>

    <Reveal variant="right"><section className="section" id="privacy">
      <div className="section-intro"><p className="eyebrow">LOCAL-FIRST PRIVACY</p><h2>Work stays local<br /><i>until you choose otherwise.</i></h2><p>Local Projects live in this browser on your machine. Cloud Projects use an account only when you opt in. Machine translation API keys stay in application memory and are not written to project files or logs.</p></div>
    </section></Reveal>

    <section className="field-notes" data-i18n-skip><div><span className="field-notes-kicker">{t('delight.notes')}</span><h2>{t('delight.notesTitle')}</h2><p>{t('delight.notesBody')}</p><AmbientGreeting /></div><TipCard context="landing" /></section>

    <Reveal variant="fade"><section className="section faq-section" id="faq"><div className="section-intro"><p className="eyebrow">GOOD QUESTIONS</p><h2>Before you<br /><i>start translating.</i><FaqLocaleSecret /></h2></div><div className="faq-list">{[
      ['Is LocalizationHub free?', `The current v${site.version} release is available through GitHub Releases. Local Projects work without an account.`],
      ['Do I need an account?', 'No. Local Projects work without an account. An account is only needed for Cloud Projects and online collaboration.'],
      ['What can I open?', 'Localization files — JSON, CSV, gettext PO, and LocalizationHub Project files (.lhproj) — parse, edit, and export. Game projects — Godot, Unreal, and Unity folders — scan, extract, and review.'],
      ['Does LocalizationHub extract files from games?', 'Yes. Read-only extraction from Godot, Unreal, and Unity game folders. Some deep binary formats remain partial; see the engine compatibility notes.'],
      ['Does it support Arabic?', 'Yes. The interface and translation fields follow Arabic as a right-to-left language when you switch the UI locale.'],
      ['Does my work stay on this machine?', 'Local Projects stay in this browser until you delete them. Keep your own backups. Cloud Projects persist for the project and its members until an authorized member removes them.'],
      ['What is a Cloud Project?', 'An optional shared project with persistent workflow data, assignments, comments, activity, and Owner, Editor, and Viewer permissions.'],
    ].map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section></Reveal>
  </main><GameMemeSecret /><Footer /></>
}


function DownloadPage() { return <><Header /><main className="inner-page download-page"><p className="eyebrow">RELEASE / {site.version}</p><div className="download-layout"><div><h1>LocalizationHub<br /><i>{site.releaseTitle}</i></h1><p className="page-lede">A local-first Windows workspace for game localization, plus JSON, CSV, and PO files.</p><a className="button button-primary" href={site.releaseUrl}>Download from GitHub <span>↗</span></a><a className="button button-quiet" href={site.releaseUrl}>View release notes <span>↗</span></a></div><div className="download-panel"><div className="panel-mark"><img src="/localizationhub-logo.jpg" alt="" /></div><span className="panel-kicker">CURRENT STABLE RELEASE</span><h2>v{site.version}</h2><div className="download-fact"><span>Installer</span><strong data-i18n-skip>{['LocalizationHub_', site.version, '_x64-setup.exe'].join('')}</strong></div><div className="download-fact"><span>Platform</span><strong>Windows x64</strong></div><div className="download-fact"><span>Works with</span><strong>Local Projects · Optional Cloud Projects</strong></div></div></div></main><Footer /></> }

function DocumentPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const privacy = kind === 'privacy'
  const privacySections: Array<[string, string]> = [
    ['Local Projects', 'Local Projects stay on your machine unless you explicitly choose to use a Cloud Project or an online collaboration feature.'],
    ['Cloud Projects', 'Cloud Projects use authenticated accounts and PostgreSQL-backed project storage. Project members can access data according to their Owner, Editor, or Viewer role.'],
    ['Accounts', 'Cloud features use account details needed for authentication, sessions, membership, and email verification.'],
    ['Project data', 'LocalizationHub uses project data to provide the editing, persistence, collaboration, and history features you request.'],
    ['Retention', 'Local Project copies remain in this browser until you delete them. Cloud project records persist while the project exists for its members. LocalizationHub does not publish a separate timed auto-deletion schedule.'],
    ['Deletion', 'You can delete a Local Project copy from the Web App. Authorized Cloud members can delete a Cloud Project. A standalone self-serve “delete my entire account” portal is not part of the current Web App.'],
    ['Logs', 'The collaboration server handles API requests for Cloud features. The product does not expose a customer log-export screen, and this page does not claim a specific log-retention period.'],
    ['Analytics', 'The public website and Web App do not include third-party marketing analytics snippets. LH Radio does not build tracking around the player.'],
    ['API keys', 'Machine translation API keys are kept in application memory and are not stored in project files, localization files, application configuration, local storage, or logs.'],
    ['Third-party infrastructure', 'The public release is distributed through GitHub Releases. Cloud infrastructure and email delivery may change as the product evolves.'],
    ['Music and third-party embeds', 'LH Radio streams audio tracks that are uploaded and administered directly by LocalizationHub. LocalizationHub does not build tracking around the player and does not receive any third-party account details.'],
    ['Contact', 'For privacy questions, open an issue on the official GitHub repository or use the DEDWRITE link in the site footer. This site does not publish a dedicated privacy email address.'],
    ['Updates', 'This page describes the current product and may be updated when behavior changes.'],
  ]
  const termsSections: Array<[string, string]> = [
    ['Using LocalizationHub', 'Use the editor to work with localization files you already have. Do not use the product to violate the rights of others or to interfere with systems you do not control.'],
    ['Local files and backups', 'Keep backups of important localization files and projects. Local Projects are stored on your machine and remain your responsibility.'],
    ['Cloud Projects', 'Cloud access is permission-based. Respect project roles and the work of other collaborators.'],
    ['Accounts', 'Keep your account credentials private and use accurate information when creating an account.'],
    ['Software availability', 'Features and availability may change while LocalizationHub continues to develop.'],
    ['Releases and updates', 'Download releases from the official repository and review release notes before updating.'],
    ['Changes to these terms', 'These terms may be revised as the product and public website develop.'],
  ]
  return <><Header /><main className="inner-page document-page"><p className="eyebrow">LOCALIZATIONHUB / {privacy ? 'PRIVACY' : 'TERMS'}</p><article><h1>{privacy ? 'Privacy, in plain language.' : 'Terms for using the workspace.'}</h1><p className="page-lede">{privacy ? 'This page describes what LocalizationHub does with your files and account data.' : 'These terms describe practical expectations for using LocalizationHub.'}</p>{(privacy ? privacySections : termsSections).map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}</article></main><Footer /></>
}

function NotFound() { return <><Header /><main className="inner-page not-found"><p className="eyebrow">404 / ENTRY NOT FOUND</p><h1>Page not found.</h1><p>The route you requested does not exist.</p><InternalLink className="button button-primary" href="/">Back to LocalizationHub</InternalLink></main><Footer /></> }
function Footer() { return <footer><InternalLink className="brand" href="/"><img className="brand-icon" src="/localizationhub-logo.jpg" alt="" /><span>{site.name}</span></InternalLink><span>v{site.version} · {site.releaseTitle}</span><div><LanguageSwitcher /><a href={site.repositoryUrl}>GitHub</a><a href={site.releaseUrl}>Releases</a><span className="muted">Documentation / upcoming</span><a className="creator-signature" href="https://dedwrite.xyz/" target="_blank" rel="noopener noreferrer">DEDWRITE</a><FooterSecret /></div></footer> }
export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => { const handle = (event: PopStateEvent) => { if (allowHistoryNavigation(event)) setPath(window.location.pathname) }; window.addEventListener('popstate', handle); return () => window.removeEventListener('popstate', handle) }, [])
  const suppressRadio = path === '/app/admin' || path.startsWith('/app/admin/')
  const isAppSurface = path.startsWith('/app')
  return <><RoutedPage path={path} /><CommandCenter />{!suppressRadio && <LhRadio />}{isAppSurface && <LanguageSwitcher dock />}</>
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
