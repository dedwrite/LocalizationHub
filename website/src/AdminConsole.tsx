import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type {
  AdminAuditLog,
  AdminDashboard,
  AdminProject,
  AdminSession,
  AdminUser,
} from './adminApi'
import {
  beginTotpEnrollment,
  changeProjectRoleAdmin,
  confirmTotp,
  deleteProjectAdmin,
  deleteUserAdmin,
  getAdminDashboard,
  getAdminProject,
  getAdminProjects,
  getAdminUser,
  getAdminUsers,
  getAuditLog,
  getStorageMetrics,
  getUserSessions,
  hasAdminSession,
  hasNormalSession,
  logoutAdmin,
  reconfirmTotp,
  removeProjectMemberAdmin,
  requestEmailCode,
  revokeAllSessionsAdmin,
  revokeSessionAdmin,
  suspendUserAdmin,
  transferOwnershipAdmin,
  unsuspendUserAdmin,
  unverifyUserEmailAdmin,
  verifyEmailCode,
  verifyUserEmailAdmin,
} from './adminApi'
import './admin-console.css'

type Page = 'security' | 'dashboard' | 'users' | 'user-detail' | 'projects' | 'project-detail' | 'audit'
type RunAction = (action: () => Promise<unknown>) => Promise<void>
type Navigate = (to: string) => void

type ConfirmState = {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  checkboxLabel?: string
  onConfirm: (checkboxChecked: boolean) => Promise<void> | void
}

function parseRoute(pathname: string): { page: Page; id?: string } {
  const rest = pathname.replace(/^\/app\/admin\/?/, '')
  const parts = rest.split('/').filter(Boolean)
  if (parts.length === 0) return { page: 'dashboard' }
  if (parts[0] === 'security') return { page: 'security' }
  if (parts[0] === 'users') return parts[1] ? { page: 'user-detail', id: parts[1] } : { page: 'users' }
  if (parts[0] === 'projects') return parts[1] ? { page: 'project-detail', id: parts[1] } : { page: 'projects' }
  if (parts[0] === 'audit') return { page: 'audit' }
  return { page: 'dashboard' }
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size.toFixed(1)} ${units[unit]}`
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString()
}

function formatRole(role?: string | null): string {
  if (!role) return '—'
  return role.replaceAll('_', ' ')
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric-card">
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  )
}

function Empty({ children }: { children: string }) {
  return <p className="admin-empty">{children}</p>
}

function ActionError({ message }: { message: string }) {
  if (!message) return null
  return <p className="admin-error" role="alert">{message}</p>
}

function ConfirmModal({ state, onCancel }: { state: ConfirmState; onCancel: () => void }) {
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    try {
      await state.onConfirm(checked)
      onCancel()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={state.title}>
      <div className="modal-card">
        <h3>{state.title}</h3>
        <p>{state.body}</p>
        {state.checkboxLabel && (
          <label className="admin-checkbox">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            {state.checkboxLabel}
          </label>
        )}
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="admin-btn" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className={`admin-btn ${state.danger ? 'admin-btn-danger' : 'admin-btn-primary'}`} disabled={busy} onClick={submit}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function TotpModal({
  code,
  error,
  onChange,
  onSubmit,
  onCancel,
}: {
  code: string
  error: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm with Authenticator">
      <div className="modal-card">
        <h3>Confirm with Authenticator</h3>
        <p>This sensitive action requires a fresh Authenticator code.</p>
        <label className="admin-field">
          Authenticator code
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => onChange(e.target.value)} maxLength={6} />
        </label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="admin-btn" onClick={onCancel}>Cancel</button>
          <button className="admin-btn admin-btn-primary" disabled={code.length !== 6} onClick={onSubmit}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

function SecurityGate({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<'email' | 'totp'>('email')
  const [code, setCode] = useState('')
  const [totp, setTotp] = useState('')
  const [setup, setSetup] = useState<{ uri: string; secret: string } | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handle(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-console">
      <div className="admin-gate">
        <h1>Admin Access</h1>
        <p className="admin-lede">Multi-factor verification is required to access operator controls.</p>
        {step === 'email' ? (
          <>
            <button
              className="admin-btn"
              disabled={busy}
              onClick={() => handle(() => requestEmailCode().then(() => setMessage('A six-digit code was emailed to your account.')))}
            >
              Request email code
            </button>
            <label className="admin-field">
              Email code
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
            </label>
            <button
              className="admin-btn admin-btn-primary"
              disabled={busy || code.length !== 6}
              onClick={() => handle(() => verifyEmailCode(code).then(() => { setMessage('Email verified.'); setStep('totp') }))}
            >
              Verify email
            </button>
          </>
        ) : (
          <>
            <button
              className="admin-btn"
              disabled={busy || Boolean(setup)}
              onClick={() => handle(() => beginTotpEnrollment().then((enrollment) => { setSetup(enrollment); setShowKey(false) }))}
            >
              {setup ? 'Authenticator configured' : 'Setup Authenticator'}
            </button>
            {setup && (
              <div className="admin-qr">
                <p className="admin-lede">Scan with Google Authenticator:</p>
                <div className="admin-qr-box">
                  <QRCodeSVG value={setup.uri} size={200} marginSize={2} aria-label="Authenticator QR code" />
                </div>
                <p className="admin-qr-warning">Do not share this QR code or setup key. Anyone with it can access this admin account.</p>
                <button
                  className="admin-btn admin-btn-link"
                  onClick={() => setShowKey((v) => !v)}
                  aria-expanded={showKey}
                >
                  {showKey ? 'Hide setup key' : "Can't scan the QR? Show setup key"}
                </button>
                {showKey && (
                  <code className="totp-uri" data-testid="totp-setup-key">{setup.secret}</code>
                )}
              </div>
            )}
            <label className="admin-field">
              Authenticator code
              <input inputMode="numeric" autoComplete="one-time-code" value={totp} onChange={(e) => setTotp(e.target.value)} maxLength={6} />
            </label>
            <button
              className="admin-btn admin-btn-primary"
              disabled={busy || totp.length !== 6}
              onClick={() => handle(() => confirmTotp(totp).then(() => onSuccess()))}
            >
              Confirm TOTP
            </button>
          </>
        )}
        {message && <p className="admin-message">{message}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
      </div>
    </main>
  )
}

function DashboardView({ data }: { data: AdminDashboard }) {
  const metrics = data.metrics
  return (
    <>
      <section className="admin-section">
        <h2>Platform metrics</h2>
        <div className="metric-cards">
          <MetricCard label="Total users" value={metrics.total_users} />
          <MetricCard label="Verified users" value={metrics.verified_users} />
          <MetricCard label="Unverified users" value={metrics.unverified_users} />
          <MetricCard label="Suspended" value={metrics.suspended_users} />
          <MetricCard label="Cloud projects" value={metrics.total_projects} />
          <MetricCard label="Memberships" value={metrics.total_memberships} />
          <MetricCard label="Active sessions" value={metrics.active_sessions} />
          <MetricCard label="Logical storage" value={formatBytes(metrics.logical_storage)} />
        </div>
      </section>
      <section className="admin-section">
        <h2>Recent activity</h2>
        {data.recentActivity.length === 0 ? (
          <Empty>No recent admin activity.</Empty>
        ) : (
          <div className="admin-table-wrap" tabIndex={0}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((log) => (
                  <tr key={log.id}>
                    <td>{log.admin_username || log.admin_user_id}</td>
                    <td>{log.action}</td>
                    <td>{log.target_type}{log.target_id ? ` · ${log.target_id.slice(0, 8)}` : ''}</td>
                    <td>{formatDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

const PAGE_SIZE = 20

function UsersView({ onNavigate }: { onNavigate: Navigate }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    getAdminUsers(query, PAGE_SIZE, offset)
      .then((result) => {
        if (alive) {
          setUsers(result.users)
          setTotal(result.total)
        }
      })
      .catch((e) => {
        if (alive) setError((e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [query, offset])

  return (
    <section className="admin-section">
      <h2>Users</h2>
      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(search)
          setOffset(0)
        }}
      >
        <input
          className="admin-search"
          type="search"
          id="admin-user-search"
          name="admin-user-search-field"
          role="searchbox"
          aria-autocomplete="none"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          data-lpignore="true"
          data-form-type="other"
          placeholder="Search username or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />
        <button className="admin-btn admin-btn-primary" type="submit">Search</button>
      </form>
      {loading ? (
        <p className="admin-message">Loading…</p>
      ) : error ? (
        <ActionError message={error} />
      ) : users.length === 0 ? (
        <Empty>No users found.</Empty>
      ) : (
        <div className="admin-table-wrap" tabIndex={0}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Verified</th>
                <th>Status</th>
                <th>Sessions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{user.email_verified_at ? 'Yes' : 'No'}</td>
                  <td>{user.suspended_at ? 'Suspended' : 'Active'}</td>
                  <td>{user.session_count}</td>
                  <td>
                    <button className="admin-btn" onClick={() => onNavigate(`/app/admin/users/${user.id}`)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={total} offset={offset} onChange={setOffset} />
    </section>
  )
}

function UserDetailView({ userId, run, onNavigate }: { userId: string; run: RunAction; onNavigate: Navigate }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [ownedProjects, setOwnedProjects] = useState<{ projectId: string; projectName: string; bytes: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  async function reload() {
    setError('')
    try {
      const [detail, sessionList, storage] = await Promise.all([
        getAdminUser(userId),
        getUserSessions(userId),
        getStorageMetrics(userId),
      ])
      setUser(detail)
      setSessions(sessionList.sessions)
      setOwnedProjects(storage.owned_projects || [])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([getAdminUser(userId), getUserSessions(userId), getStorageMetrics(userId)])
      .then(([detail, sessionList, storage]) => {
        if (alive) {
          setUser(detail)
          setSessions(sessionList.sessions)
          setOwnedProjects(storage.owned_projects || [])
        }
      })
      .catch((e) => {
        if (alive) setError((e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [userId])

  async function act(action: () => Promise<unknown>) {
    setActionError('')
    try {
      await run(action)
      await reload()
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  if (loading) {
    return (
      <section className="admin-section">
        <p className="admin-message">Loading…</p>
      </section>
    )
  }
  if (error || !user) {
    return (
      <section className="admin-section">
        <ActionError message={error || 'User not found.'} />
      </section>
    )
  }

  const isSuspended = Boolean(user.suspended_at)

  return (
    <section className="admin-section">
      <div className="admin-detail-head">
        <h2>{user.username}</h2>
        <button className="admin-btn" onClick={() => onNavigate('/app/admin/users')}>← Users</button>
      </div>
      <ActionError message={actionError} />
      <div className="admin-detail-grid">
        <div className="detail-panel">
          <h3>Account</h3>
          <dl className="detail-list">
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Role</dt><dd>{formatRole(user.site_role)}</dd>
            <dt>Email verified</dt><dd>{user.email_verified_at ? `Yes (${formatDate(user.email_verified_at)})` : 'No'}</dd>
            <dt>Status</dt><dd>{isSuspended ? 'Suspended' : 'Active'}</dd>
            <dt>Created</dt><dd>{formatDate(user.created_at)}</dd>
          </dl>
        </div>
        <div className="detail-panel">
          <h3>Projects</h3>
          <dl className="detail-list">
            <dt>Owned</dt><dd>{user.owned_projects ?? 0}</dd>
            <dt>Shared</dt><dd>{user.shared_projects ?? 0}</dd>
            <dt>Logical storage</dt><dd>{formatBytes(user.logical_storage)}</dd>
          </dl>
          {ownedProjects.length > 0 && (
            <div className="admin-table-wrap" tabIndex={0}>
              <table className="admin-table">
                <thead><tr><th>Project</th><th>Storage</th></tr></thead>
                <tbody>
                  {ownedProjects.map((project) => (
                    <tr key={project.projectId}>
                      <td>{project.projectName}</td>
                      <td>{formatBytes(project.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="detail-panel">
        <h3>Sessions ({sessions.length})</h3>
        {sessions.length === 0 ? (
          <Empty>No active sessions.</Empty>
        ) : (
          <div className="admin-table-wrap" tabIndex={0}>
            <table className="admin-table">
              <thead><tr><th>Session</th><th>Created</th><th>Expires</th><th /></tr></thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.token_hash}>
                    <td>{session.token_hash.slice(0, 12)}…</td>
                    <td>{formatDate(session.created_at)}</td>
                    <td>{formatDate(session.expires_at)}</td>
                    <td>
                      <button className="admin-btn admin-btn-danger" onClick={() => act(() => revokeSessionAdmin(session.token_hash))}>Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="detail-panel admin-actions">
        <h3>Actions</h3>
        {isSuspended ? (
          <button className="admin-btn" onClick={() => act(() => unsuspendUserAdmin(user.id))}>Unsuspend</button>
        ) : (
          <button className="admin-btn admin-btn-danger" onClick={() => setConfirm({
            title: 'Suspend user',
            body: `Suspend ${user.username}? All of their sessions will be revoked immediately.`,
            confirmLabel: 'Suspend',
            danger: true,
            onConfirm: () => act(() => suspendUserAdmin(user.id)),
          })}>
            Suspend
          </button>
        )}
        {user.email_verified_at ? (
          <button className="admin-btn" onClick={() => act(() => unverifyUserEmailAdmin(user.id))}>Unverify email</button>
        ) : (
          <button className="admin-btn" onClick={() => act(() => verifyUserEmailAdmin(user.id))}>Verify email</button>
        )}
        <button className="admin-btn admin-btn-danger" onClick={() => setConfirm({
          title: 'Revoke all sessions',
          body: `Revoke all ${sessions.length} active session(s) for ${user.username}?`,
          confirmLabel: 'Revoke all',
          danger: true,
          onConfirm: () => act(() => revokeAllSessionsAdmin(user.id)),
        })}>
          Revoke all sessions
        </button>
        <button className="admin-btn admin-btn-danger" onClick={() => setConfirm({
          title: 'Delete user',
          body: `Permanently delete ${user.username}? This cannot be undone.`,
          confirmLabel: 'Delete user',
          danger: true,
          checkboxLabel: 'Also permanently delete all projects this user owns',
          onConfirm: (deleteProjects) => act(() => deleteUserAdmin(user.id, deleteProjects)).then(() => onNavigate('/app/admin/users')),
        })}>
          Delete user
        </button>
      </div>

      {confirm && <ConfirmModal state={confirm} onCancel={() => setConfirm(null)} />}
    </section>
  )
}

function ProjectsView({ onNavigate }: { onNavigate: Navigate }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    getAdminProjects(query, PAGE_SIZE, offset)
      .then((result) => {
        if (alive) {
          setProjects(result.projects)
          setTotal(result.total)
        }
      })
      .catch((e) => {
        if (alive) setError((e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [query, offset])

  return (
    <section className="admin-section">
      <h2>Projects</h2>
      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(search)
          setOffset(0)
        }}
      >
        <input
          className="admin-search"
          type="search"
          id="admin-project-search"
          name="admin-project-search-field"
          role="searchbox"
          aria-autocomplete="none"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          data-lpignore="true"
          data-form-type="other"
          placeholder="Search project or owner"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search projects"
        />
        <button className="admin-btn admin-btn-primary" type="submit">Search</button>
      </form>
      {loading ? (
        <p className="admin-message">Loading…</p>
      ) : error ? (
        <ActionError message={error} />
      ) : projects.length === 0 ? (
        <Empty>No projects found.</Empty>
      ) : (
        <div className="admin-table-wrap" tabIndex={0}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Owner</th>
                <th>Members</th>
                <th>Entries</th>
                <th>Storage</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.owner_username}</td>
                  <td>{project.member_count}</td>
                  <td>{project.entry_count}</td>
                  <td>{formatBytes(project.logical_size)}</td>
                  <td>
                    <button className="admin-btn" onClick={() => onNavigate(`/app/admin/projects/${project.id}`)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={total} offset={offset} onChange={setOffset} />
    </section>
  )
}

function ProjectDetailView({ projectId, run, onNavigate }: { projectId: string; run: RunAction; onNavigate: Navigate }) {
  const [project, setProject] = useState<AdminProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [transferTarget, setTransferTarget] = useState('')

  async function reload() {
    try {
      setProject(await getAdminProject(projectId))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    getAdminProject(projectId)
      .then((detail) => {
        if (alive) setProject(detail)
      })
      .catch((e) => {
        if (alive) setError((e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [projectId])

  async function act(action: () => Promise<unknown>) {
    setActionError('')
    try {
      await run(action)
      await reload()
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  if (loading) {
    return (
      <section className="admin-section">
        <p className="admin-message">Loading…</p>
      </section>
    )
  }
  if (error || !project) {
    return (
      <section className="admin-section">
        <ActionError message={error || 'Project not found.'} />
      </section>
    )
  }

  const members = project.members || []

  return (
    <section className="admin-section">
      <div className="admin-detail-head">
        <h2>{project.name}</h2>
        <button className="admin-btn" onClick={() => onNavigate('/app/admin/projects')}>← Projects</button>
      </div>
      <ActionError message={actionError} />
      <div className="admin-detail-grid">
        <div className="detail-panel">
          <h3>Details</h3>
          <dl className="detail-list">
            <dt>Owner</dt><dd>{project.owner_username}</dd>
            <dt>Members</dt><dd>{project.member_count}</dd>
            <dt>Entries</dt><dd>{project.entry_count}</dd>
            <dt>Storage</dt><dd>{formatBytes(project.logical_size)}</dd>
            <dt>Created</dt><dd>{formatDate(project.created_at)}</dd>
            <dt>Updated</dt><dd>{formatDate(project.updated_at)}</dd>
          </dl>
        </div>
        <div className="detail-panel">
          <h3>Members</h3>
          {members.length === 0 ? (
            <Empty>No members.</Empty>
          ) : (
            <div className="admin-table-wrap" tabIndex={0}>
              <table className="admin-table">
                <thead><tr><th>Username</th><th>Role</th><th /></tr></thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td>{member.username}</td>
                      <td>{formatRole(member.role)}</td>
                      <td className="member-actions">
                        <button
                          className="admin-btn"
                          disabled={member.id === project.owner_id}
                          onClick={() => act(() => changeProjectRoleAdmin(project.id, member.id, member.role === 'editor' ? 'viewer' : 'editor'))}
                        >
                          {member.role === 'editor' ? 'Make viewer' : 'Make editor'}
                        </button>
                        <button
                          className="admin-btn admin-btn-danger"
                          disabled={member.id === project.owner_id}
                          onClick={() => setConfirm({
                            title: 'Remove member',
                            body: `Remove ${member.username} from ${project.name}?`,
                            confirmLabel: 'Remove',
                            danger: true,
                            onConfirm: () => act(() => removeProjectMemberAdmin(project.id, member.id)),
                          })}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="detail-panel admin-actions">
        <h3>Actions</h3>
        <div className="admin-inline">
          <label className="admin-field">
            Transfer ownership to
            <select value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)}>
              <option value="">Select a member…</option>
              {members.map((member) => (
                <option key={member.id} value={member.id} disabled={member.id === project.owner_id}>
                  {member.username}
                </option>
              ))}
            </select>
          </label>
          <button
            className="admin-btn admin-btn-danger"
            disabled={!transferTarget}
            onClick={() => setConfirm({
              title: 'Transfer ownership',
              body: `Transfer ownership of ${project.name} to the selected member?`,
              confirmLabel: 'Transfer',
              danger: true,
              onConfirm: () => act(() => transferOwnershipAdmin(project.id, transferTarget)),
            })}
          >
            Transfer ownership
          </button>
        </div>
        <button
          className="admin-btn admin-btn-danger"
          onClick={() => setConfirm({
            title: 'Delete project',
            body: `Permanently delete ${project.name} and all of its entries, comments, and activity? This cannot be undone.`,
            confirmLabel: 'Delete project',
            danger: true,
            onConfirm: () => act(() => deleteProjectAdmin(project.id)).then(() => onNavigate('/app/admin/projects')),
          })}
        >
          Delete project
        </button>
      </div>

      {confirm && <ConfirmModal state={confirm} onCancel={() => setConfirm(null)} />}
    </section>
  )
}

function AuditView() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    getAuditLog(PAGE_SIZE * 2, offset, action || undefined)
      .then((result) => {
        if (alive) {
          setLogs(result.logs)
          setTotal(result.total)
        }
      })
      .catch((e) => {
        if (alive) setError((e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [offset, action])

  return (
    <section className="admin-section">
      <h2>Audit log</h2>
      <div className="admin-toolbar">
        <label className="admin-field">
          Filter by action
          <select value={action} onChange={(e) => { setAction(e.target.value); setOffset(0) }}>
            <option value="">All actions</option>
            <option value="admin.user.suspend">User suspended</option>
            <option value="admin.user.unsuspend">User unsuspended</option>
            <option value="admin.user.verify_email">Email verified</option>
            <option value="admin.user.unverify_email">Email unverified</option>
            <option value="admin.user.sessions_revoke_all">Sessions revoked</option>
            <option value="admin.session.revoke">Session revoked</option>
            <option value="admin.user.delete">User deleted</option>
            <option value="admin.project.delete">Project deleted</option>
            <option value="admin.project.member_role_change">Role changed</option>
            <option value="admin.project.member_remove">Member removed</option>
            <option value="admin.project.ownership_transfer">Ownership transferred</option>
          </select>
        </label>
      </div>
      {loading ? (
        <p className="admin-message">Loading…</p>
      ) : error ? (
        <ActionError message={error} />
      ) : logs.length === 0 ? (
        <Empty>No audit entries.</Empty>
      ) : (
        <div className="admin-table-wrap" tabIndex={0}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Action</th>
                <th>Target</th>
                <th>Result</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.admin_username || log.admin_user_id}</td>
                  <td>{log.action}</td>
                  <td>{log.target_type}{log.target_id ? ` · ${log.target_id.slice(0, 8)}` : ''}</td>
                  <td>{log.success ? 'Success' : 'Failed'}</td>
                  <td>{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={total} offset={offset} onChange={setOffset} />
    </section>
  )
}

function Pagination({ total, offset, onChange }: { total: number; offset: number; onChange: (next: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.floor(offset / PAGE_SIZE) + 1
  return (
    <div className="admin-pagination">
      <button className="admin-btn" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}>
        Previous
      </button>
      <span>Page {current} of {pages} ({total} total)</span>
      <button className="admin-btn" disabled={offset + PAGE_SIZE >= total} onClick={() => onChange(offset + PAGE_SIZE)}>
        Next
      </button>
    </div>
  )
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button className={`admin-btn admin-nav-btn${active ? ' admin-nav-active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      {children}
    </button>
  )
}

export default function AdminConsole() {
  const [path, setPath] = useState(window.location.pathname)
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [fatal, setFatal] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [totpOpen, setTotpOpen] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [totpError, setTotpError] = useState('')
  const pendingRef = useRef<{ action: () => Promise<unknown>; resolve: () => void; reject: (e: unknown) => void } | null>(null)

  const navigate: Navigate = (to) => {
    window.history.pushState({}, '', to)
    setPath(to)
  }

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!hasAdminSession()) {
      setAuthChecked(true)
      return
    }
    getAdminDashboard()
      .then((data) => {
        setDashboard(data)
        setAuthChecked(true)
      })
      .catch((e) => {
        setFatal((e as Error).message)
        setAuthChecked(true)
      })
  }, [])

  function run(action: () => Promise<unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      action().then(() => resolve()).catch((e) => {
        if ((e as { code?: string }).code === 'recent-totp-required') {
          pendingRef.current = { action, resolve, reject }
          setTotpCode('')
          setTotpError('')
          setTotpOpen(true)
          return
        }
        reject(e)
      })
    })
  }

  async function submitTotp() {
    try {
      await reconfirmTotp(totpCode)
      const pending = pendingRef.current
      pendingRef.current = null
      setTotpOpen(false)
      if (pending) {
        try {
          await pending.action()
          pending.resolve()
        } catch (e) {
          pending.reject(e)
        }
      }
    } catch (e) {
      setTotpError((e as Error).message)
    }
  }

  async function logout() {
    await logoutAdmin()
    setDashboard(null)
    setFatal('')
    navigate('/app/admin/security')
  }

  if (!authChecked) {
    return (
      <main className="admin-console">
        <p className="admin-message">Loading…</p>
      </main>
    )
  }

  if (!hasNormalSession()) {
    return (
      <main className="admin-console">
        <div className="admin-gate">
          <h1>Admin Access</h1>
          <p className="admin-lede">Sign in to your LocalizationHub account to access operator controls.</p>
          <a className="admin-btn admin-btn-primary" href="/app/login">Sign in</a>
        </div>
      </main>
    )
  }

  const route = parseRoute(path)

  if (route.page === 'security' || (!dashboard && !fatal)) {
    return (
      <SecurityGate
        onSuccess={() => {
          getAdminDashboard()
            .then((data) => {
              setDashboard(data)
              setFatal('')
              navigate('/app/admin')
            })
            .catch((e) => setFatal((e as Error).message))
        }}
      />
    )
  }

  if (!dashboard) {
    return (
      <main className="admin-console">
        <div className="admin-gate">
          <h1>Admin Access</h1>
          <p className="admin-error" role="alert">{fatal || 'Admin session expired.'}</p>
          <button className="admin-btn admin-btn-primary" onClick={() => navigate('/app/admin/security')}>Return to sign-in</button>
        </div>
      </main>
    )
  }

  let view: React.ReactNode = null
  if (route.page === 'dashboard') {
    view = <DashboardView data={dashboard} />
  } else if (route.page === 'users') {
    view = <UsersView onNavigate={navigate} />
  } else if (route.page === 'user-detail' && route.id) {
    view = <UserDetailView userId={route.id} run={run} onNavigate={navigate} />
  } else if (route.page === 'projects') {
    view = <ProjectsView onNavigate={navigate} />
  } else if (route.page === 'project-detail' && route.id) {
    view = <ProjectDetailView projectId={route.id} run={run} onNavigate={navigate} />
  } else if (route.page === 'audit') {
    view = <AuditView />
  } else {
    view = <DashboardView data={dashboard} />
  }

  return (
    <main className="admin-console">
      <header className="admin-header">
        <span className="admin-brand">Admin · {dashboard.user.username}</span>
        <nav className="admin-nav" aria-label="Admin navigation">
          <NavButton active={route.page === 'dashboard'} onClick={() => navigate('/app/admin')}>Dashboard</NavButton>
          <NavButton active={route.page === 'users' || route.page === 'user-detail'} onClick={() => navigate('/app/admin/users')}>Users</NavButton>
          <NavButton active={route.page === 'projects' || route.page === 'project-detail'} onClick={() => navigate('/app/admin/projects')}>Projects</NavButton>
          <NavButton active={route.page === 'audit'} onClick={() => navigate('/app/admin/audit')}>Audit</NavButton>
        </nav>
        <button className="admin-btn" onClick={logout}>Logout</button>
      </header>
      {view}
      {confirm && <ConfirmModal state={confirm} onCancel={() => setConfirm(null)} />}
      {totpOpen && (
        <TotpModal
          code={totpCode}
          error={totpError}
          onChange={setTotpCode}
          onSubmit={submitTotp}
          onCancel={() => {
            pendingRef.current = null
            setTotpOpen(false)
          }}
        />
      )}
    </main>
  )
}
