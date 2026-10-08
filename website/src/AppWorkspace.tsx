import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '@localizationhub/i18n'
import ProjectDeleteDialog from '../../frontend/src/ProjectDeleteDialog'
import AccountDeleteDialog from '../../frontend/src/AccountDeleteDialog'
import { deleteAccount, deleteProject } from './appApi'
import { parseLocalizationFile } from '@localizationhub/core'
import { createTokenProfileConfig } from '@localizationhub/core'
import { createProject, getStoredUser, listProjects, login, logout, register, restoreSession, sendVerification, type AuthUser, type ProjectSummary } from './appApi'
import { navigate } from './navigation'
import LocalWorkspace from './LocalWorkspace'
import Workspace from './workspace/Workspace'
import NewProjectModal from './workspace/NewProjectModal'
import { assertCurrentWebBuild } from './webBuild'
import TipCard from './delight/TipCard'
import ResumeCard from './delight/ResumeCard'
import { lastCloudProject, latestDated } from './delight/recents'
import AmbientGreeting from './delight/AmbientGreeting'
import ProjectMark from './delight/ProjectMark'
import { EmptyConstellation, ExperienceSkeleton } from './delight/ExperienceState'
import { openCommandCenter, PROJECT_SEARCH_EVENT } from './delight/commandEvents'
import ShortcutKey from './components/ShortcutKey'
import { registerQuietCommands } from './delight/quietCommands'
import './app-workspace.css'
import './workspace/workspace.css'
import './app-workspace.mobile.css'
import './workspace/workspace.mobile.css'

type View = 'login' | 'register' | 'projects' | 'editor' | 'local'
function routeView(path = window.location.pathname): View { if (path === '/app/login') return 'login'; if (path === '/app/register') return 'register'; if (path === '/app/local') return 'local'; if (path.startsWith('/app/projects/')) return 'editor'; return path.startsWith('/app') ? 'projects' : 'login' }
function friendlyStatus(status: string) { return status.replace('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }

export default function AppWorkspace() {
  const [view, setView] = useState<View>(() => routeView())
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [ready, setReady] = useState(false)
  useEffect(() => { const onPop = () => setView(routeView()); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop) }, [])
  useEffect(() => { restoreSession().then((restored) => { setUser(restored); setReady(true) }) }, [])
  useEffect(() => { if (!ready) return; if (!user && view !== 'login' && view !== 'register' && view !== 'local') navigate('/app/login'); if (user && (view === 'login' || view === 'register')) navigate('/app/projects') }, [ready, user, view])
  if (!ready) return <main className="workspace-page"><ExperienceSkeleton label="delight.loading.restore" /></main>
  if (view === 'login' || view === 'register') return <AuthView mode={view} onAuth={(next) => { setUser(next); navigate('/app/projects') }} />
  if (view === 'local') return <LocalWorkspace />
  if (!user) return <main className="workspace-page"><ExperienceSkeleton label="delight.loading.restore" /></main>
  if (view === 'editor') return <Workspace user={user} onHome={() => navigate('/app/projects')} />
  return <ProjectsView user={user} onLogout={() => { logout().finally(() => { setUser(null); navigate('/app/login') }) }} onAccountDeleted={() => { setUser(null); navigate('/') }} />
}

function AuthView({ mode, onAuth }: { mode: 'login' | 'register'; onAuth: (user: AuthUser) => void }) {
  const [username, setUsername] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { const result = mode === 'login' ? await login(username, password) : await register(username, email, password); onAuth(result.user) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Authentication failed.') } finally { setBusy(false) } }
  return <main className="auth-page"><section className="auth-card"><p className="app-kicker">LOCALIZATIONHUB / WEB APP</p><h1>{mode === 'login' ? 'Welcome back.' : 'Start translating anywhere.'}</h1><p className="auth-lede">{mode === 'login' ? 'Sign in to your Cloud Projects.' : 'Create an account for browser-based Cloud Projects.'}</p><form onSubmit={submit}><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>{mode === 'register' && <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>}<label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><button className="text-button" onClick={() => navigate(mode === 'login' ? '/app/register' : '/app/login')}>{mode === 'login' ? 'Create an account' : 'Already have an account? Sign in'}</button></section></main>
}

function AppHeader({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { t } = useI18n()
  return <header className="app-header">
    <button className="app-brand" onClick={() => navigate('/app/projects')}><img className="brand-mark" src="/brand-primary.svg" alt="" /><span>LocalizationHub <small>WEB APP</small></span></button>
    <nav className="app-context-nav" aria-label="Project context">
      <button className="active" aria-current="page" onClick={() => navigate('/app/projects')}><span>Cloud</span><small>Collaborative</small></button>
      <button onClick={() => navigate('/app/local')}><span>Local</span><small>On this device</small></button>
    </nav>
    <button type="button" className="command-launcher" onClick={() => openCommandCenter()} aria-label={t('delight.command.open')}><span>{t('delight.command.quick')}</span><ShortcutKey /></button><div className="account"><span>{user.username}<small>{user.emailVerified ? 'Verified account' : 'Email unverified'}</small></span><button onClick={onLogout}>Log out</button></div>
  </header>
}

function ProjectsView({ user, onLogout, onAccountDeleted }: { user: AuthUser; onLogout: () => void; onAccountDeleted: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verification, setVerification] = useState(false)
  const [notice, setNotice] = useState(() => new URLSearchParams(window.location.search).get('deleted') === '1' ? 'Cloud Project deleted permanently.' : '')
  const [newOpen, setNewOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  async function refresh() { setLoading(true); setError(''); try { setProjects(await listProjects()) } catch (failure) { const typed = failure as any; if (typed.code === 'email-verification-required') setVerification(true); else setError(failure instanceof Error ? failure.message : 'Could not load projects.') } finally { setLoading(false) } }
  useEffect(() => { refresh() }, [])
  useEffect(() => {
    const focusSearch = () => searchRef.current?.focus()
    window.addEventListener(PROJECT_SEARCH_EVENT, focusSearch)
    return () => window.removeEventListener(PROJECT_SEARCH_EVENT, focusSearch)
  }, [])

  async function resend() { try { await sendVerification(); setNotice('Verification email sent. Check your inbox.') } catch (failure) { setNotice(failure instanceof Error ? failure.message : 'Could not send verification email.') } }

  async function handleCreate(name: string) { await createProject(name); await refresh() }

  async function handleImport(name: string, file: File) {
    await assertCurrentWebBuild()
    const parsed = parseLocalizationFile(await file.text(), file.name)
    if (!parsed.ok) throw new Error(parsed.reason)
    const doc = parsed.document
    const project = {
      format: 'LocalizationHubProject',
      version: 3,
      sourceFileName: file.name,
      selectedEntryId: null,
      tokenProfile: 'auto',
      tokenProfileConfig: createTokenProfileConfig('auto'),
      document: { parser: doc.parser, format: doc.format, sourceText: doc.sourceText, schema: doc.schema, language: doc.language },
      entries: doc.entries,
      workflow: { entries: {} },
    }
    await createProject(name, project)
    await refresh()
  }

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    if (!text) return projects
    return projects.filter((project) => project.name.toLowerCase().includes(text) || (project.sourceFileName ?? '').toLowerCase().includes(text))
  }, [projects, search])

  const projectSummary = useMemo(() => {
    const entries = projects.reduce((sum, project) => sum + (project.entryCount ?? 0), 0)
    const translated = projects.reduce((sum, project) => sum + (project.translatedCount ?? 0), 0)
    return { entries, translated, completion: entries ? Math.round((translated / entries) * 100) : 0 }
  }, [projects])
  const openedId = useMemo(() => lastCloudProject(user.id), [user.id, projects])
  const resume = projects.find(project => project.id === openedId) ?? latestDated(projects, project => project.updatedAt)

  useEffect(() => {
    const recent = [...projects]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, 5)
    return registerQuietCommands(recent.map((project) => ({
      id: `cloud.recent.${project.id}`,
      label: `Open ${project.name}`,
      keywords: `recent cloud ${project.name} ${project.sourceFileName ?? ''}`,
      group: 'project' as const,
      run: () => navigate(`/app/projects/${project.id}`),
    })))
  }, [projects])

  return <main className="workspace-page projects-page">
    <AppHeader user={user} onLogout={onLogout} />
    <section className="dashboard">
      <div className="dashboard-heading">
        <div><p className="app-kicker">CLOUD PROJECTS / COLLABORATIVE</p><h1>Your projects.</h1><p className="muted">Open a shared project and pick up where your team left off.</p><AmbientGreeting /></div>
        <div className="heading-actions"><button onClick={refresh} title="Refresh projects">↻ Refresh</button><button className="primary-button" onClick={() => setNewOpen(true)}>+ New project</button></div>
      </div>
      {!loading && projects.length > 0 && <div className="project-summary" aria-label="Cloud Project summary">
        <div><span>PROJECTS</span><strong>{projects.length}</strong><small>Available to you</small></div>
        <div><span>ENTRIES</span><strong>{projectSummary.entries.toLocaleString()}</strong><small>Across your projects</small></div>
        <div><span>TRANSLATED</span><strong>{projectSummary.completion}%</strong><small>{projectSummary.translated.toLocaleString()} entries with text</small></div>
      </div>}
      {verification && <div className="notice warning"><strong>Verify your email to open Cloud Projects.</strong><button onClick={resend}>Resend verification email</button></div>}
      {notice && <div className="notice">{notice}</div>}
      {error && <div className="notice danger">{error}</div>}
      {!loading && !error && !verification && !search && resume && <ResumeCard kind={resume.id === openedId ? 'cloud-opened' : 'cloud-updated'} name={resume.name} total={resume.entryCount ?? 0} translated={resume.translatedCount ?? 0} onOpen={() => navigate(`/app/projects/${resume.id}`)} />}
      <div className="projects-toolbar">
        <div className="project-search" role="search"><span aria-hidden="true">⌕</span><input ref={searchRef} type="search" name="workspace-project-search" role="searchbox" spellCheck={false} enterKeyHint="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by project or source file" aria-label="Search projects" /></div>
        <span className="result-count">{loading ? 'SYNCING' : `${filtered.length} OF ${projects.length} PROJECTS`}</span>
      </div>
      {loading ? <ExperienceSkeleton label="delight.loading.projects" variant="compact" /> : filtered.length === 0 ? <div className="empty-state intentional-empty"><EmptyConstellation kind={projects.length === 0 ? 'project' : 'search'} /><strong>{projects.length === 0 ? 'No Cloud Projects yet.' : 'No projects match your search.'}</strong><span>{projects.length === 0 ? 'Create a project or import an existing localization file when you are ready.' : 'Try a different project name or source file.'}</span><button className="primary-button" onClick={projects.length === 0 ? () => setNewOpen(true) : () => setSearch('')}>{projects.length === 0 ? '+ Create your first project' : 'Clear search'}</button></div> : <div className={`project-layout ${filtered.length === 1 ? 'single-project-layout' : ''}`}><div className="project-grid">{filtered.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => navigate(`/app/projects/${project.id}`)} onDeleted={() => { setProjects((current) => current.filter((item) => item.id !== project.id)); setNotice('Cloud Project deleted permanently.') }} />)}</div>{filtered.length === 1 && <ProjectSupportPanel project={filtered[0]} onOpen={() => navigate(`/app/projects/${filtered[0].id}`)} onNew={() => setNewOpen(true)} />}</div>}
      <TipCard context="projects" />
      <AccountDangerZone user={user} ownedProjects={projects.filter((project) => project.role === 'owner').length} onDeleted={onAccountDeleted} />
    </section>
    {newOpen && <NewProjectModal onClose={() => setNewOpen(false)} onCreate={handleCreate} onImport={handleImport} />}
    <MobileNav />
  </main>
}

/* The account itself has one home: a quiet band under the projects. Deleting it
 * is permanent and irreversible, so the confirmation asks for the address and
 * for every Cloud Project the account owns. */
function AccountDangerZone({ user, ownedProjects, onDeleted }: { user: AuthUser; ownedProjects: number; onDeleted: () => void }) {
  const { t } = useI18n()
  const [deleting, setDeleting] = useState(false)
  return <section className="account-danger-zone" aria-labelledby="account-danger-title">
    <div className="account-danger-copy">
      <h2 id="account-danger-title">{t('accountDelete.zoneTitle')}</h2>
      <p>{t('accountDelete.zoneNote')}</p>
      <p className="account-danger-identity"><bdi>{user.email}</bdi></p>
    </div>
    <div className="account-danger-actions"><button type="button" className="account-danger-open" onClick={() => setDeleting(true)}>{t('accountDelete.open')}</button></div>
    {deleting && <AccountDeleteDialog email={user.email} ownedProjects={ownedProjects} onDelete={async (deleteOwnedProjects) => { await deleteAccount(user.email, deleteOwnedProjects) }} onDeleted={onDeleted} onCancel={() => setDeleting(false)} />}
  </section>
}

function ProjectCard({ project, onOpen, onDeleted }: { project: ProjectSummary; onOpen: () => void; onDeleted: () => void }) {
  const { t } = useI18n()
  const [deleting, setDeleting] = useState(false)
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const total = project.entryCount ?? 0
  const translated = project.translatedCount ?? 0
  const percent = total ? Math.round((translated / total) * 100) : 0
  const sourceLabel = project.sourceFileName || 'LocalizationHub Project'
  return (
    <div className="project-card-shell">
    <button className="project-card" onClick={onOpen} aria-label={`Open ${project.name}`}>
      <div className="project-card-top"><ProjectMark name={project.name} size="md" className="project-glyph" /><span className="project-role">{friendlyStatus(project.role)}</span></div>
      <div className="project-title"><strong><bdi>{project.name}</bdi></strong><span aria-hidden="true">↗</span></div>
      <span className="project-file">{sourceLabel}</span>
      <div className="project-progress-label"><span>Translation progress</span><strong>{percent}%</strong></div>
      <div className="project-progress" aria-hidden="true"><div className="project-progress-fill" style={{ width: `${percent}%` }} /></div>
      <div className="project-facts"><span>{total.toLocaleString()} entries</span><span>Rev {project.revision}</span><span>{project.memberCount ?? 1} {(project.memberCount ?? 1) === 1 ? 'member' : 'members'}</span></div>
      <small>Updated {new Date(project.updatedAt).toLocaleDateString()}</small>
    </button>
    {project.role === 'owner' && <details ref={menu} className="project-card-actions" data-i18n-skip onKeyDown={(event) => { if (event.key === 'Escape' && menu.current) { menu.current.open = false; menu.current.querySelector('summary')?.focus() } }}><summary aria-label={t('delete.actions')}>⋯</summary><button type="button" onClick={() => { if (menu.current) menu.current.open = false; setDeleting(true) }}>{t('delete.project')}</button></details>}
    {deleting && project.role === 'owner' && <ProjectDeleteDialog name={project.name} onDelete={() => deleteProject(project.id)} onDeleted={onDeleted} onCancel={() => setDeleting(false)} />}
    </div>
  )
}

function ProjectSupportPanel({ project, onOpen, onNew }: { project: ProjectSummary; onOpen: () => void; onNew: () => void }) {
  const total = project.entryCount ?? 0
  const translated = project.translatedCount ?? 0
  return <aside className="project-support" aria-label="Project quick actions">
    <span className="support-kicker">ONE PROJECT / KEEP MOVING</span>
    <h2>Continue working.</h2>
    <p>Open a project to continue translating, or open a local file without uploading it.</p>
    <div className="support-facts"><div><span>Source</span><strong>{project.sourceFileName || 'LocalizationHub Project'}</strong></div><div><span>Coverage</span><strong>{translated.toLocaleString()} of {total.toLocaleString()} entries translated</strong></div><div><span>Access</span><strong>{friendlyStatus(project.role)} · Rev {project.revision}</strong></div></div>
    <div className="support-actions"><button className="primary-button" onClick={onOpen}>Open project <span aria-hidden="true">↗</span></button><button onClick={onNew}>+ New Cloud Project</button><button onClick={() => navigate('/app/local')}>Open Local Project</button></div>
  </aside>
}

function MobileNav() { const onLocal = window.location.pathname === '/app/local'; return <nav className="mobile-nav" aria-label="Projects"><button className={onLocal ? '' : 'active'} aria-current={onLocal ? undefined : 'page'} onClick={() => navigate('/app/projects')}>Cloud projects</button><button className={onLocal ? 'active' : ''} aria-current={onLocal ? 'page' : undefined} onClick={() => navigate('/app/local')}>Local browser</button></nav> }
