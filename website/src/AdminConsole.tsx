import { useEffect, useState } from 'react'
import { beginTotpEnrollment, confirmTotp, getAdminDashboard, hasAdminSession, requestEmailCode, verifyEmailCode, logoutAdmin, type AdminMetrics } from './adminApi'
import './admin-console.css'

export default function AdminConsole() {
  const [code, setCode] = useState('')
  const [totp, setTotp] = useState('')
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [setup, setSetup] = useState<{ uri: string; secret: string } | null>(null)
  const [message, setMessage] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  useEffect(() => { if (hasAdminSession()) getAdminDashboard().then((result) => setMetrics(result.metrics)).catch((error) => setMessage(error.message)) }, [])
  async function sendCode() { try { await requestEmailCode(); setMessage('Admin access code sent.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not request code.') } }
  async function verifyCode() { try { await verifyEmailCode(code); setEmailVerified(true); setMessage('Email code accepted.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Email code rejected.') } }
  async function enroll() { try { setSetup(await beginTotpEnrollment()); setMessage('Add this account to Google Authenticator, then enter its six-digit code.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not start TOTP enrollment.') } }
  async function confirm() { try { await confirmTotp(totp); setMetrics((await getAdminDashboard()).metrics); setMessage('Admin session active.') } catch (error) { setMessage(error instanceof Error ? error.message : 'TOTP rejected.') } }
  if (metrics) return <main className="admin-console"><header><span>LOCALIZATIONHUB / ADMIN</span><button onClick={() => logoutAdmin().then(() => setMetrics(null))}>Log out Admin</button></header><h1>Operator dashboard.</h1><p>Private Super Admin operations.</p><section className="admin-metrics"><strong>{metrics.total_users}<small>Users</small></strong><strong>{metrics.verified_users}<small>Verified</small></strong><strong>{metrics.total_projects}<small>Cloud Projects</small></strong><strong>{metrics.logical_project_bytes}<small>Logical project bytes</small></strong></section></main>
  return <main className="admin-console"><h1>Admin access.</h1><p>Normal account authentication is only the first step.</p><button onClick={sendCode}>Send email code</button><label>Email code<input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} /></label><button onClick={verifyCode} disabled={!code}>Verify email code</button>{emailVerified && <><button onClick={enroll}>Start Google Authenticator setup</button>{setup && <section><p>Scan this URI with Google Authenticator:</p><code>{setup.uri}</code></section>}<label>Authenticator code<input inputMode="numeric" value={totp} onChange={(event) => setTotp(event.target.value)} /></label><button onClick={confirm} disabled={!totp}>Confirm TOTP</button></>}{message && <p role="status">{message}</p>}</main>
}
