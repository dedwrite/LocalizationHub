import { useEffect, useState } from 'react'
import { beginTotpEnrollment, confirmTotp, getAdminDashboard, hasAdminSession, requestEmailCode, verifyEmailCode, logoutAdmin, type AdminMetrics } from './adminApi'
import './admin-console.css'

export default function AdminConsole() {
  const [page, setPage] = useState('security')
  const [code, setCode] = useState('')
  const [totp, setTotp] = useState('')
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [setup, setSetup] = useState<{ uri: string; secret: string } | null>(null)
  const [message, setMessage] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)

  useEffect(() => {
    if (hasAdminSession()) {
      getAdminDashboard()
        .then(r => {
          setMetrics(r.metrics)
          setPage('dashboard')
        })
        .catch(e => {
          setMessage((e as Error).message)
        })
    }
  }, [])

  if (!metrics) {
    return (
      <main className="admin-console">
        <h1>Admin Access</h1>
        <p>Multi-factor verification required.</p>
        <div className="admin-gate">
          <button
            onClick={() =>
              requestEmailCode()
                .then(() => setMessage('Code sent'))
                .catch(e => setMessage((e as Error).message))
            }
            disabled={emailVerified}
          >
            Request email code
          </button>
          <label>
            Email code
            <input inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} maxLength={6} />
          </label>
          <button
            onClick={() =>
              verifyEmailCode(code)
                .then(() => {
                  setEmailVerified(true)
                  setMessage('Email verified')
                })
                .catch(e => setMessage((e as Error).message))
            }
            disabled={!code || emailVerified}
          >
            Verify
          </button>
          {emailVerified && (
            <>
              <button
                onClick={() =>
                  beginTotpEnrollment()
                    .then(s => {
                      setSetup(s)
                      setMessage('Scan QR with Authenticator')
                    })
                    .catch(e => setMessage((e as Error).message))
                }
              >
                Setup Authenticator
              </button>
              {setup && (
                <div>
                  <p>Scan with Google Authenticator:</p>
                  <code className="totp-uri">{setup.uri}</code>
                </div>
              )}
              <label>
                Authenticator code
                <input inputMode="numeric" value={totp} onChange={e => setTotp(e.target.value)} maxLength={6} />
              </label>
              <button
                onClick={() =>
                  confirmTotp(totp)
                    .then(() =>
                      getAdminDashboard().then(r => {
                        setMetrics(r.metrics)
                        setPage('dashboard')
                        setMessage('Admin session active')
                      })
                    )
                    .catch(e => setMessage((e as Error).message))
                }
                disabled={!totp}
              >
                Confirm TOTP
              </button>
            </>
          )}
        </div>
        {message && <p className="admin-message">{message}</p>}
      </main>
    )
  }

  if (page === 'dashboard') {
    return (
      <main className="admin-console">
        <header>
          <span>ADMIN / DASHBOARD</span>
          <button
            onClick={() => {
              logoutAdmin()
              setMetrics(null)
              setPage('security')
            }}
          >
            Logout
          </button>
        </header>
        <section className="admin-grid">
          <h2>Metrics</h2>
          <div className="metric-cards">
            <div className="metric-card">
              <div className="metric-value">{metrics?.total_users || 0}</div>
              <div className="metric-label">Total Users</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metrics?.verified_users || 0}</div>
              <div className="metric-label">Verified Users</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metrics?.suspended_users || 0}</div>
              <div className="metric-label">Suspended</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metrics?.total_projects || 0}</div>
              <div className="metric-label">Cloud Projects</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{metrics?.active_sessions || 0}</div>
              <div className="metric-label">Active Sessions</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{formatBytes(metrics?.logical_storage || 0)}</div>
              <div className="metric-label">Platform Storage</div>
            </div>
          </div>
        </section>
        <nav className="admin-nav">
          <button>Users</button>
          <button>Projects</button>
          <button>Audit Log</button>
        </nav>
      </main>
    )
  }

  return (
    <main className="admin-console">
      <h1>Admin Console</h1>
      <p>Secure Admin management interface with multi-factor authentication.</p>
    </main>
  )
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}
