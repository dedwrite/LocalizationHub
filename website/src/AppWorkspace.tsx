import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { parseLocalizationFile } from '@localizationhub/core'
import { createProject, getStoredUser, listProjects, login, logout, register, restoreSession, sendVerification, type AuthUser, type ProjectSummary } from './appApi'
import { navigate } from './navigation'
import LocalWorkspace from './LocalWorkspace'
import Workspace from './workspace/Workspace'
import NewProjectModal from './workspace/NewProjectModal'
import './app-workspace.css'
import './workspace/workspace.css'

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
  if (!ready) return <div className="app-loading">Restoring workspace…</div>
  if (view === 'login' || view === 'register') return <AuthView mode={view} onAuth={(next) => { setUser(next); navigate('/app/projects') }} />
  if (view === 'local') return <LocalWorkspace />
  if (!user) return <div className="app-loading">Opening workspace…</div>
  if (view === 'editor') return <Workspace user={user} onHome={() => navigate('/app/projects')} />
  return <ProjectsView user={user} onLogout={() => { logout().finally(() => { setUser(null); navigate('/app/login') }) }} />
}

function AuthView({ mode, onAuth }: { mode: 'login' | 'register'; onAuth: (user: AuthUser) => void }) {
  const [username, setUsername] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { const result = mode === 'login' ? await login(username, password) : await register(username, email, password); onAuth(result.user) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Authentication failed.') } finally { setBusy(false) } }
  return <main className="auth-page"><section className="auth-card"><p className="app-kicker">LOCALIZATIONHUB / WEB APP</p><h1>{mode === 'login' ? 'Welcome back.' : 'Start translating anywhere.'}</h1><p className="auth-lede">{mode === 'login' ? 'Sign in to your Cloud Projects.' : 'Create an account for browser-based Cloud Projects.'}</p><form onSubmit={submit}><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>{mode === 'register' && <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>}<label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><button className="text-button" onClick={() => navigate(mode === 'login' ? '/app/register' : '/app/login')}>{mode === 'login' ? 'Create an account' : 'Already have an account? Sign in'}</button></section></main>
}

function AppHeader({ user, onLogout }: { user: AuthUser; onLogout: () => void }) { return <header className="app-header"><button className="app-brand" onClick={() => navigate('/app/projects')}><span className="brand-mark">LH</span><span>LocalizationHub <small>WEB APP</small></span></button><div className="account"><span>{user.username}<small>{user.emailVerified ? 'Verified account' : 'Email unverified'}</small></span><button onClick={onLogout}>Log out</button></div></header> }

function ProjectsView({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verification, setVerification] = useState(false)
  const [notice, setNotice] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [search, setSearch] = useState('')

  async function refresh() { setLoading(true); setError(''); try { setProjects(await listProjects()) } catch (failure) { const typed = failure as any; if (typed.code === 'email-verification-required') setVerification(true); else setError(failure instanceof Error ? failure.message : 'Could not load projects.') } finally { setLoading(false) } }
  useEffect(() => { refresh() }, [])

  async function resend() { try { await sendVerification(); setNotice('Verification email sent. Check your inbox.') } catch (failure) { setNotice(failure instanceof Error ? failure.message : 'Could not send verification email.') } }

  async function handleCreate(name: string) { await createProject(name); await refresh() }

  async function handleImport(name: string, file: File) {
    const parsed = parseLocalizationFile(await file.text(), file.name)
    if (!parsed.ok) throw new Error(parsed.reason)
    const doc = parsed.document
    const project = {
      format: 'LocalizationHubProject',
      version: 3,
      sourceFileName: file.name,
      selectedEntryId: null,
      tokenProfile: 'generic',
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

  return <main className="workspace-page"><AppHeader user={user} onLogout={onLogout} /><section className="dashboard"><div className="dashboard-heading"><div><p className="app-kicker">CLOUD PROJECTS</p><h1>Your translation work.</h1><p className="muted">Open a project and continue from any screen.</p></div><div className="heading-actions"><button onClick={refresh} title="Refresh projects">↻ Refresh</button><button className="primary-button" onClick={() => setNewOpen(true)}>+ New project</button></div></div>{verification && <div className="notice warning"><strong>Verify your email to open Cloud Projects.</strong><button onClick={resend}>Resend verification email</button></div>}{notice && <div className="notice">{notice}</div>}{error && <div className="notice danger">{error}</div>}<div className="project-search" role="search"><input type="search" name="workspace-project-search" role="searchbox" spellCheck={false} enterKeyHint="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" aria-label="Search projects" /></div>{loading ? <div className="empty-state">Loading projects…</div> : filtered.length === 0 ? <div className="empty-state"><strong>{projects.length === 0 ? 'No Cloud Projects yet.' : 'No projects match your search.'}</strong><span>{projects.length === 0 ? 'Create a project to start translating.' : 'Try a different search term.'}</span></div> : <div className="project-grid">{filtered.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => navigate(`/app/projects/${project.id}`)} />)}</div>}</section>{newOpen && <NewProjectModal onClose={() => setNewOpen(false)} onCreate={handleCreate} onImport={handleImport} />}<MobileNav /></main>
}

function ProjectCard({ project, onOpen }: { project: ProjectSummary; onOpen: () => void }) {
  const total = project.entryCount ?? 0
  const translated = project.translatedCount ?? 0
  const percent = total ? Math.round((translated / total) * 100) : 0
  return (
    <button className="project-card" onClick={onOpen}>
      <span className="project-role">{friendlyStatus(project.role)}</span>
      <strong>{project.name}</strong>
      <span className="project-file">{project.sourceFileName || 'Localization project'}</span>
      <div className="project-progress"><div className="project-progress-fill" style={{ width: `${percent}%` }} /></div>
      <div className="project-facts">
        <span>{total} entries</span>
        <span>{percent}% translated</span>
        <span>Rev {project.revision}</span>
        <span>{project.memberCount ?? 1} member(s)</span>
      </div>
      <small>Updated {new Date(project.updatedAt).toLocaleDateString()}</small>
    </button>
  )
}

function MobileNav() { return <nav className="mobile-nav"><button onClick={() => navigate('/app/projects')}>Entries</button><button onClick={() => (document.querySelector('.search-input') as HTMLInputElement | null)?.focus()}>Search</button><button onClick={() => navigate('/app/projects')}>Project</button><button onClick={() => (document.querySelector('.inspector') as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth' })}>Tools</button><button onClick={() => navigate('/app/local')}>Local</button></nav> }
