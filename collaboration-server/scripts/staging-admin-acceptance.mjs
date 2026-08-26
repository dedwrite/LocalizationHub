// Staging Admin Console acceptance — creates disposable fixtures, runs the
// real deployed MFA flow, exercises management endpoints, then cleans up.
// No secrets are printed. Disposable fixtures only (never production identity).
import pg from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { totpCode } from '../admin.mjs'

const BASE = (process.env.STAGING_BASE_URL || '').replace(/\/+$/, '')
const DB_URL = process.env.STAGING_DATABASE_URL
if (!BASE || !DB_URL) throw new Error('STAGING_BASE_URL and STAGING_DATABASE_URL are required.')

const STAMP = Date.now().toString(36)
const PASSWORD = 'StagingAcceptance!2026'
const fixtures = {
  super: { username: `stg-super-${STAMP}`, email: `stg-super-${STAMP}@example.invalid`, role: 'super_admin' },
  normal: { username: `stg-normal-${STAMP}`, email: `stg-normal-${STAMP}@example.invalid`, role: 'user' },
  owner: { username: `stg-owner-${STAMP}`, email: `stg-owner-${STAMP}@example.invalid`, role: 'user' },
  editor: { username: `stg-editor-${STAMP}`, email: `stg-editor-${STAMP}@example.invalid`, role: 'user' },
  viewer: { username: `stg-viewer-${STAMP}`, email: `stg-viewer-${STAMP}@example.invalid`, role: 'user' },
}
const createdUserIds = []
let projectId = null

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function api(path, { method = 'GET', body, token, adminToken } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (adminToken) headers['X-Admin-Session'] = adminToken
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = null }
  return { status: res.status, json }
}

async function register(fixture) {
  const res = await api('/api/auth/register', { method: 'POST', body: { username: fixture.username, email: fixture.email, password: PASSWORD } })
  if (res.status !== 201) throw new Error(`register ${fixture.username} failed: ${res.status} ${JSON.stringify(res.json)}`)
  const id = res.json.user.id
  createdUserIds.push(id)
  if (fixture.role === 'super_admin') {
    await pool.query("UPDATE users SET site_role = 'super_admin', email_verified_at = NOW() WHERE id = $1", [id])
  }
  return { id, token: res.json.token }
}

function sha256hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

async function bruteForceEmailCode(userId) {
  const rows = await pool.query(
    'SELECT code_hash FROM admin_email_challenges WHERE user_id = $1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1',
    [userId],
  )
  const hash = rows.rows[0]?.code_hash
  if (!hash) throw new Error('No pending admin email challenge found.')
  for (let i = 0; i < 1000000; i++) {
    if (sha256hex(String(i).padStart(6, '0')) === hash) return String(i).padStart(6, '0')
  }
  throw new Error('Could not recover the 6-digit email code.')
}

async function cleanup() {
  for (const id of createdUserIds) {
    try {
      await pool.query('DELETE FROM admin_email_challenges WHERE user_id = $1', [id])
      await pool.query('DELETE FROM admin_totp_enrollments WHERE user_id = $1', [id])
      await pool.query('DELETE FROM admin_sessions WHERE user_id = $1', [id])
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [id])
      await pool.query('DELETE FROM project_memberships WHERE user_id = $1', [id])
      if (projectId) {
        await pool.query('DELETE FROM project_memberships WHERE project_id = $1', [projectId])
        await pool.query('DELETE FROM project_assignments WHERE project_id = $1', [projectId])
        await pool.query('DELETE FROM project_comments WHERE project_id = $1', [projectId])
        await pool.query('DELETE FROM project_activity WHERE project_id = $1', [projectId])
        await pool.query('DELETE FROM projects WHERE id = $1', [projectId])
      }
      await pool.query('DELETE FROM admin_audit_log WHERE admin_user_id = $1', [id])
      await pool.query('DELETE FROM users WHERE id = $1', [id])
    } catch (error) {
      console.log(`cleanup warning for ${id}: ${error.message}`)
    }
  }
}

async function main() {
  console.log(`Staging acceptance — stamp ${STAMP}`)
  console.log(`Target: ${BASE}`)

  // 1. Fixtures
  const superAdmin = await register(fixtures.super)
  const normal = await register(fixtures.normal)
  const owner = await register(fixtures.owner)
  const editor = await register(fixtures.editor)
  await register(fixtures.viewer)

  // Create a representative project owned by owner, with editor + viewer members.
  const proj = await pool.query(
    `INSERT INTO projects (id, name, owner_user_id, project, revision)
     VALUES ($1, $2, $3, $4::jsonb, 1) RETURNING id`,
    [randomUUID(), `stg-project-${STAMP}`, owner.id, JSON.stringify({ format: 'LocalizationHubProject', version: 3, sourceFileName: 'x.json', entries: [{ id: 'entry-1', translation: 'x' }], workflow: { entries: {} } })],
  )
  projectId = proj.rows[0].id
  await pool.query('INSERT INTO project_memberships (project_id, user_id, role) VALUES ($1,$2,$3),($1,$4,$5)',
    [projectId, editor.id, 'editor', viewer.id, 'viewer'])

  // 2. Security: unauthenticated and non-admin rejection
  const unauth = await api('/api/admin')
  check('unauthenticated /api/admin rejected (401)', unauth.status === 401, `status=${unauth.status}`)

  const normalLogin = await api('/api/auth/login', { method: 'POST', body: { username: fixtures.normal.username, password: PASSWORD } })
  const normalForbidden = await api('/api/admin', { token: normalLogin.json.token })
  check('normal user /api/admin rejected (403)', normalForbidden.status === 403, `status=${normalForbidden.status}`)

  // super admin with only a normal session (no admin session) must be rejected
  const superLogin = await api('/api/auth/login', { method: 'POST', body: { username: fixtures.super.username, password: PASSWORD } })
  const superToken = superLogin.json.token
  const superNoAdminSession = await api('/api/admin', { token: superToken })
  check('super_admin normal session alone rejected', superNoAdminSession.status === 403, `status=${superNoAdminSession.status} code=${superNoAdminSession.json?.error}`)

  // 3. Email challenge
  const emailReq = await api('/api/admin/auth/email/request', { method: 'POST', token: superToken })
  // Email delivery may fail if Resend is unconfigured; the challenge is still created.
  const emailCode = await bruteForceEmailCode(superAdmin.id)
  const emailBad = await api('/api/admin/auth/email/verify', { method: 'POST', token: superToken, body: { code: '000000' } })
  check('invalid email OTP rejected', emailBad.status === 403, `status=${emailBad.status}`)
  const emailOk = await api('/api/admin/auth/email/verify', { method: 'POST', token: superToken, body: { code: emailCode } })
  check('valid email OTP accepted', emailOk.status === 200, `status=${emailOk.status}`)
  const emailReplay = await api('/api/admin/auth/email/verify', { method: 'POST', token: superToken, body: { code: emailCode } })
  check('replayed email OTP rejected', emailReplay.status !== 200, `status=${emailReplay.status}`)

  // 4. TOTP enrollment + confirmation
  const enroll = await api('/api/admin/auth/totp/enroll', { method: 'POST', token: superToken })
  check('TOTP enrollment returns secret+uri', enroll.status === 200 && Boolean(enroll.json?.secret), `status=${enroll.status}`)
  const badTotp = await api('/api/admin/auth/totp/confirm', { method: 'POST', token: superToken, body: { code: '000000' } })
  check('invalid TOTP rejected', badTotp.status === 403, `status=${badTotp.status}`)
  const goodTotp = totpCode(enroll.json.secret)
  const totpOk = await api('/api/admin/auth/totp/confirm', { method: 'POST', token: superToken, body: { code: goodTotp } })
  check('valid TOTP creates admin session', totpOk.status === 200 && Boolean(totpOk.json?.adminToken), `status=${totpOk.status}`)
  const adminToken = totpOk.json.adminToken

  // 5. Dashboard
  const dash = await api('/api/admin', { token: superToken, adminToken })
  check('dashboard returns metrics', dash.status === 200 && Number.isInteger(dash.json?.metrics?.total_users), `status=${dash.status}`)

  // 6. Users management
  const users = await api('/api/admin/users', { token: superToken, adminToken })
  check('list users returns array + total', users.status === 200 && Array.isArray(users.json?.users), `status=${users.status}`)
  const userDetail = await api(`/api/admin/users/${normal.id}`, { token: superToken, adminToken })
  check('user detail returns counts', userDetail.status === 200 && userDetail.json?.username === fixtures.normal.username, `status=${userDetail.status}`)

  // 7. Destructive actions require recent TOTP (fresh admin session has it)
  const suspend = await api(`/api/admin/users?action=suspend&userId=${normal.id}`, { method: 'POST', token: superToken, adminToken })
  check('suspend user succeeds with recent TOTP', suspend.status === 200, `status=${suspend.status}`)
  const unsuspend = await api(`/api/admin/users?action=unsuspend&userId=${normal.id}`, { method: 'POST', token: superToken, adminToken })
  check('unsuspend user succeeds', unsuspend.status === 200, `status=${unsuspend.status}`)

  // 8. Projects management
  const projects = await api('/api/admin/projects', { token: superToken, adminToken })
  check('list projects returns array + total', projects.status === 200 && Array.isArray(projects.json?.projects), `status=${projects.status}`)
  const projectDetail = await api(`/api/admin/projects/${projectId}`, { token: superToken, adminToken })
  check('project detail returns members', projectDetail.status === 200 && Array.isArray(projectDetail.json?.members), `status=${projectDetail.status}`)

  // 9. Sessions + audit
  const sessions = await api(`/api/admin/sessions?userId=${normal.id}`, { token: superToken, adminToken })
  check('list user sessions', sessions.status === 200 && Array.isArray(sessions.json?.sessions), `status=${sessions.status}`)
  const audit = await api('/api/admin/audit', { token: superToken, adminToken })
  check('audit log lists entries', audit.status === 200 && Array.isArray(audit.json?.logs), `status=${audit.status}`)

  // 10. Logout + revoked admin session rejection
  const logout = await api('/api/admin/auth/logout', { method: 'POST', token: superToken, adminToken })
  check('admin logout succeeds', logout.status === 200, `status=${logout.status}`)
  const afterLogout = await api('/api/admin', { token: superToken, adminToken })
  check('revoked admin session rejected', afterLogout.status === 403, `status=${afterLogout.status}`)

  await cleanup()

  // Verify cleanup
  const remaining = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE username LIKE $1', [`stg-%${STAMP}%`])
  check('staging fixtures cleaned up (zero users remain)', remaining.rows[0].n === 0, `remaining=${remaining.rows[0].n}`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} acceptance checks passed.`)
  await pool.end()
  if (failed.length) process.exit(1)
}

main().catch(async (error) => {
  console.error('Acceptance aborted:', error.message)
  try { await cleanup() } catch {}
  try { await pool.end() } catch {}
  process.exit(1)
})
