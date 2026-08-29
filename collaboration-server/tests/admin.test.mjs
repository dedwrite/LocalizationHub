import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { resetDatabasePoolForTests, setDatabasePoolForTests } from '../database.mjs'
import {
  AdminSecurityError,
  authenticateAdminSession,
  base32Decode,
  base32Encode,
  bootstrapSuperAdmin,
  changeProjectMemberRole,
  confirmAdminTotpAndCreateSession,
  deleteProject,
  deleteUser,
  generateTotpSecret,
  getPlatformMetrics,
  getProject,
  getRecentActivity,
  getAdminTotpStatus,
  getStorageBreakdown,
  getUser,
  hasRecentAdminEmailVerification,
  listAuditLog,
  listProjects,
  listUserSessions,
  listUsers,
  otpauthUri,
  reconfirmAdminTotp,
  removeUserProjectMembership,
  requestAdminEmailCode,
  requireRecentTotp,
  revokeAllUserSessions,
  revokeSession,
  suspendUser,
  totpCode,
  transferProjectOwnership,
  unsuspendUser,
  unverifyUserEmail,
  verifyAdminEmailCode,
  verifyAdminTotp,
  verifyTotp,
  verifyUserEmail,
} from '../admin.mjs'

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROJECT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function rows(list) { return { rows: list, rowCount: list.length } }
function row(obj) { return rows([obj]) }
function empty() { return rows([]) }

class FakeClient {
  constructor(handlers = {}) {
    this.handlers = handlers
    this.calls = []
    this.released = false
  }
  async query(sql, params) {
    this.calls.push({ sql, params })
    if (/^(BEGIN|COMMIT|ROLLBACK)$/u.test(sql.trim())) return { rows: [], rowCount: 0 }
    for (const [needle, handler] of Object.entries(this.handlers)) {
      if (sql.includes(needle)) {
        const result = typeof handler === 'function' ? handler(sql, params) : handler
        if (result && result.error) throw result.error
        return result
      }
    }
    return empty()
  }
  release() { this.released = true }
}
function pool(client) { return { connect: async () => client, query: (...args) => client.query(...args) } }

function auditHas(client, action) {
  return client.calls.some((call) => call.sql.includes('INSERT INTO admin_audit_log') && (call.params || []).includes(action))
}

afterEach(() => {
  delete process.env.ADMIN_SECURITY_KEY
  resetDatabasePoolForTests()
})

describe('admin TOTP primitives', () => {
  it('uses six digits and accepts only the current window', () => {
    const secret = generateTotpSecret()
    const timestamp = Date.UTC(2026, 7, 26, 12, 0, 0)
    const code = totpCode(secret, timestamp)
    assert.match(code, /^\d{6}$/)
    assert.equal(verifyTotp(secret, code, timestamp), true)
    assert.equal(verifyTotp(secret, '000000', timestamp), false)
    assert.match(otpauthUri(secret, 'operator'), /^otpauth:\/\/totp\/LocalizationHub:/)
  })

  it('rejects malformed codes before comparison', () => {
    const secret = generateTotpSecret()
    assert.equal(verifyTotp(secret, '12345'), false)
    assert.equal(verifyTotp(secret, 'abcdef'), false)
    assert.equal(verifyTotp(secret, ''), false)
  })
})

describe('Base32 secret format (RFC 4648)', () => {
  it('generates uppercase A-Z2-7 secrets with no padding and 20 bytes of entropy', () => {
    for (let i = 0; i < 50; i++) {
      const secret = generateTotpSecret()
      assert.match(secret, /^[A-Z2-7]+$/, `secret ${secret} contains non-Base32 characters`)
      assert.equal(secret.includes('='), false)
      assert.equal(secret.includes('-'), false)
      assert.equal(secret.includes('_'), false)
      assert.equal(secret, secret.toUpperCase())
      assert.equal(secret.length, 32) // 20 bytes -> 160 bits -> 32 Base32 chars
    }
  })

  it('generates distinct secrets (entropy)', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateTotpSecret()))
    assert.equal(seen.size, 200)
  })

  it('decodes a known static Base32 vector to the correct bytes', () => {
    // "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" is the RFC 4226/6238 test secret,
    // the Base32 encoding of ASCII "12345678901234567890".
    const decoded = base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    assert.equal(decoded.toString('utf8'), '12345678901234567890')
  })

  it('round-trips bytes through encode and decode', () => {
    const bytes = Buffer.from('12345678901234567890', 'utf8')
    const encoded = base32Encode(bytes)
    assert.equal(encoded, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    assert.equal(base32Decode(encoded).toString('utf8'), '12345678901234567890')
  })

  it('rejects secrets with characters outside the Base32 alphabet', () => {
    assert.throws(() => base32Decode('abc+123'), AdminSecurityError)
    assert.throws(() => base32Decode('A-Z_2-7'), AdminSecurityError)
  })
})

describe('independent RFC 6238 TOTP vectors', () => {
  // RFC 4226 Appendix D test vectors (secret = "12345678901234567890",
  // Base32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"), 6-digit HOTP at each counter.
  const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
  const vectors = [
    { counter: 0, code: '755224' },
    { counter: 1, code: '287082' },
    { counter: 2, code: '359152' },
    { counter: 3, code: '969429' },
    { counter: 4, code: '338314' },
    { counter: 5, code: '254676' },
    { counter: 6, code: '287922' },
    { counter: 7, code: '162583' },
    { counter: 8, code: '399871' },
    { counter: 9, code: '520489' },
  ]

  it('matches the RFC 4226 HOTP test vectors independently', () => {
    for (const { counter, code } of vectors) {
      assert.equal(totpCode(RFC_SECRET, counter * 1000 * 30), code, `counter ${counter}`)
    }
  })

  it('verifyTotp accepts the independent RFC code at the right timestamp', () => {
    // counter 1 at t=30s -> code 287082
    assert.equal(verifyTotp(RFC_SECRET, '287082', 30 * 1000), true)
    assert.equal(verifyTotp(RFC_SECRET, '000000', 30 * 1000), false)
  })
})

describe('otpauth URI standards compliance', () => {
  it('emits a Google Authenticator-compatible URI', () => {
    const secret = generateTotpSecret()
    const uri = otpauthUri(secret, 'operator@example.com')
    assert.match(uri, /^otpauth:\/\/totp\/LocalizationHub:/)
    const url = new URL(uri)
    assert.equal(url.protocol, 'otpauth:')
    assert.match(url.searchParams.get('secret') ?? '', /^[A-Z2-7]+$/)
    assert.equal(url.searchParams.get('issuer'), 'LocalizationHub')
    assert.equal(url.searchParams.get('algorithm'), 'SHA1')
    assert.equal(url.searchParams.get('digits'), '6')
    assert.equal(url.searchParams.get('period'), '30')
    // Label is the URL-encoded username after the issuer prefix.
    assert.match(uri, /LocalizationHub:operator%40example\.com/)
  })

  it('secret in the URI is the generated Base32 secret', () => {
    const secret = generateTotpSecret()
    const uri = otpauthUri(secret, 'operator')
    const url = new URL(uri)
    assert.equal(url.searchParams.get('secret'), secret)
    assert.match(secret, /^[A-Z2-7]+$/)
  })
})

describe('super admin bootstrap and lookup', () => {
  it('rejects an empty bootstrap username', async () => {
    await assert.rejects(bootstrapSuperAdmin('  '), AdminSecurityError)
  })

  it('bootstraps a verified account into super_admin', async () => {
    const client = new FakeClient({ "UPDATE users SET site_role": row({ id: ADMIN_ID, username: 'operator' }) })
    setDatabasePoolForTests(pool(client))
    const result = await bootstrapSuperAdmin('OPERATOR')
    assert.equal(result.username, 'operator')
    assert.ok(client.calls[0].sql.includes("site_role = 'super_admin'"))
  })
})

describe('admin session authentication', () => {
  it('validates and refreshes an active Admin session in one database round trip', async () => {
    const client = new FakeClient({
      'UPDATE admin_sessions AS session': row({
        user_id: ADMIN_ID,
        last_used_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        site_role: 'super_admin',
        suspended_at: null,
      }),
    })
    setDatabasePoolForTests(pool(client))
    const session = await authenticateAdminSession('admin-token', ADMIN_ID)
    assert.equal(session.user_id, ADMIN_ID)
    assert.equal(client.calls.length, 1)
    assert.equal(client.calls[0].params[2], 20 * 60 * 1000)
  })

  it('returns null when the atomic Admin session refresh matches no active session', async () => {
    const client = new FakeClient({ 'UPDATE admin_sessions AS session': empty() })
    setDatabasePoolForTests(pool(client))
    assert.equal(await authenticateAdminSession('expired-token', ADMIN_ID), null)
    assert.equal(client.calls.length, 1)
  })
})

describe('admin email challenge', () => {
  it('refuses email challenge for a non-super-admin', async () => {
    const client = new FakeClient({ "WHERE id = $1 AND site_role": empty() })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(requestAdminEmailCode(USER_ID), AdminSecurityError)
  })

  it('requests a code and invalidates prior challenges', async () => {
    const client = new FakeClient({ "WHERE id = $1 AND site_role": row({ id: ADMIN_ID, username: 'operator', email: 'op@example.com' }) })
    setDatabasePoolForTests(pool(client))
    const challenge = await requestAdminEmailCode(ADMIN_ID)
    assert.match(challenge.code, /^\d{6}$/)
    assert.equal(challenge.user.email, 'op@example.com')
    assert.ok(client.calls.some((c) => c.sql.includes('UPDATE admin_email_challenges SET used_at')))
    assert.ok(client.calls.some((c) => c.sql.includes('INSERT INTO admin_email_challenges')))
  })

  it('rejects an invalid email code and increments attempts', async () => {
    const client = new FakeClient({
      'SELECT id, code_hash, attempts, expires_at FROM admin_email_challenges': row({ id: 'challenge-1', code_hash: 'deadbeef', attempts: 0, expires_at: new Date(Date.now() + 60000).toISOString() }),
    })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(verifyAdminEmailCode(ADMIN_ID, '000000'), AdminSecurityError)
    assert.ok(client.calls.some((c) => c.sql.includes('SET attempts = attempts + 1')))
  })

  it('rejects an expired email code', async () => {
    const client = new FakeClient({
      'SELECT id, code_hash, attempts, expires_at FROM admin_email_challenges': row({ id: 'challenge-1', code_hash: 'deadbeef', attempts: 0, expires_at: new Date(Date.now() - 1000).toISOString() }),
    })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(verifyAdminEmailCode(ADMIN_ID, '123456'), AdminSecurityError)
    assert.ok(!client.calls.some((c) => c.sql.includes('SET used_at')))
  })

  it('rejects an exhausted challenge (10 attempts)', async () => {
    const client = new FakeClient({
      'SELECT id, code_hash, attempts, expires_at FROM admin_email_challenges': row({ id: 'challenge-1', code_hash: 'deadbeef', attempts: 10, expires_at: new Date(Date.now() + 60000).toISOString() }),
    })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(verifyAdminEmailCode(ADMIN_ID, '123456'), AdminSecurityError)
  })

  it('reports a recent email verification from the database', async () => {
    const client = new FakeClient({ 'SELECT used_at FROM admin_email_challenges': row({ used_at: new Date().toISOString() }) })
    setDatabasePoolForTests(pool(client))
    assert.equal(await hasRecentAdminEmailVerification(ADMIN_ID), true)
  })

  it('reports no recent email verification when absent', async () => {
    const client = new FakeClient({ 'SELECT used_at FROM admin_email_challenges': empty() })
    setDatabasePoolForTests(pool(client))
    assert.equal(await hasRecentAdminEmailVerification(ADMIN_ID), false)
  })

  it('reports no recent email verification when stale', async () => {
    const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    const client = new FakeClient({ 'SELECT used_at FROM admin_email_challenges': row({ used_at: stale }) })
    setDatabasePoolForTests(pool(client))
    assert.equal(await hasRecentAdminEmailVerification(ADMIN_ID), false)
  })
})

describe('recent TOTP gate', () => {
  it('requires a recent TOTP when none is present', async () => {
    const client = new FakeClient({ 'SELECT recent_totp_at FROM admin_sessions': empty() })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(requireRecentTotp('token', ADMIN_ID), AdminSecurityError)
  })

  it('requires a recent TOTP when the confirmation is stale', async () => {
    const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    const client = new FakeClient({ 'SELECT recent_totp_at FROM admin_sessions': row({ recent_totp_at: stale }) })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(requireRecentTotp('token', ADMIN_ID), AdminSecurityError)
  })

  it('accepts a fresh TOTP confirmation', async () => {
    const fresh = new Date().toISOString()
    const client = new FakeClient({ 'SELECT recent_totp_at FROM admin_sessions': row({ recent_totp_at: fresh }) })
    setDatabasePoolForTests(pool(client))
    assert.equal(await requireRecentTotp('token', ADMIN_ID), true)
  })

  it('refuses reconfirmation without a valid admin session', async () => {
    const client = new FakeClient({ 'SELECT id FROM admin_sessions': empty() })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(reconfirmAdminTotp('token', ADMIN_ID, '123456'), AdminSecurityError)
  })
})

describe('TOTP verification and reconfirmation', () => {
  function encryptedRow(secret) {
    const key = createHash('sha256').update('test-admin-key', 'utf8').digest()
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
    return { encrypted_secret: encrypted.toString('base64url'), nonce: nonce.toString('base64url'), auth_tag: cipher.getAuthTag().toString('base64url'), confirmed_at: new Date().toISOString() }
  }

  it('verifies a correct TOTP against an encrypted secret', async () => {
    process.env.ADMIN_SECURITY_KEY = 'test-admin-key'
    const secret = generateTotpSecret()
    const code = totpCode(secret)
    const client = new FakeClient({ 'SELECT encrypted_secret, nonce, auth_tag, confirmed_at': row(encryptedRow(secret)) })
    setDatabasePoolForTests(pool(client))
    assert.equal(await verifyAdminTotp(ADMIN_ID, code), true)
  })

  it('returns totp-not-enrolled when confirmation is attempted before enrollment', async () => {
    const client = new FakeClient({ 'SELECT encrypted_secret, nonce, auth_tag, confirmed_at': empty() })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(
      confirmAdminTotpAndCreateSession(ADMIN_ID, '123456'),
      (error) => error instanceof AdminSecurityError && error.code === 'totp-not-enrolled',
    )
    assert.ok(!client.calls.some((c) => c.sql.includes('INSERT INTO admin_sessions')))
  })

  it('rejects an incorrect TOTP', async () => {
    process.env.ADMIN_SECURITY_KEY = 'test-admin-key'
    const secret = generateTotpSecret()
    const client = new FakeClient({ 'SELECT encrypted_secret, nonce, auth_tag, confirmed_at': row(encryptedRow(secret)) })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(
      verifyAdminTotp(ADMIN_ID, '000000'),
      (error) => error instanceof AdminSecurityError && error.code === 'totp-invalid',
    )
  })

  it('returns a safe configuration error when ADMIN_SECURITY_KEY is missing', async () => {
    const secret = generateTotpSecret()
    const client = new FakeClient({ 'SELECT encrypted_secret, nonce, auth_tag, confirmed_at': row(encryptedRow(secret)) })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(
      verifyAdminTotp(ADMIN_ID, '000000'),
      (error) => error instanceof AdminSecurityError && error.code === 'admin-security-unconfigured',
    )
  })

  it('returns a safe key-mismatch error when the enrollment cannot be decrypted', async () => {
    process.env.ADMIN_SECURITY_KEY = 'different-admin-key'
    const secret = generateTotpSecret()
    const client = new FakeClient({ 'SELECT encrypted_secret, nonce, auth_tag, confirmed_at': row(encryptedRow(secret)) })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(
      verifyAdminTotp(ADMIN_ID, '000000'),
      (error) => error instanceof AdminSecurityError && error.code === 'admin-security-key-mismatch',
    )
  })

  it('creates an Admin session after validating an existing enrollment', async () => {
    process.env.ADMIN_SECURITY_KEY = 'test-admin-key'
    const secret = generateTotpSecret()
    const code = totpCode(secret)
    const client = new FakeClient({
      'SELECT encrypted_secret, nonce, auth_tag, confirmed_at': row(encryptedRow(secret)),
      'INSERT INTO admin_sessions': empty(),
    })
    setDatabasePoolForTests(pool(client))
    const token = await confirmAdminTotpAndCreateSession(ADMIN_ID, code)
    assert.equal(typeof token, 'string')
    assert.ok(token.length > 20)
    assert.ok(client.calls.some((c) => c.sql.includes('INSERT INTO admin_sessions')))
  })

  it('reconfirms TOTP and refreshes recent_totp_at', async () => {
    process.env.ADMIN_SECURITY_KEY = 'test-admin-key'
    const secret = generateTotpSecret()
    const code = totpCode(secret)
    const client = new FakeClient({
      'SELECT id FROM admin_sessions': row({ id: 'session-1' }),
      'SELECT encrypted_secret, nonce, auth_tag, confirmed_at': row(encryptedRow(secret)),
    })
    setDatabasePoolForTests(pool(client))
    assert.equal(await reconfirmAdminTotp('token', ADMIN_ID, code), true)
    assert.ok(client.calls.some((c) => c.sql.includes('SET recent_totp_at = NOW()')))
  })
})

describe('Admin TOTP enrollment status', () => {
  it('reports a confirmed existing enrollment without returning secret material', async () => {
    const client = new FakeClient({
      'SELECT confirmed_at FROM admin_totp_enrollments': row({ confirmed_at: new Date().toISOString() }),
    })
    setDatabasePoolForTests(pool(client))
    assert.deepEqual(await getAdminTotpStatus(ADMIN_ID), { enrolled: true, confirmed: true })
  })

  it('reports when no enrollment exists', async () => {
    const client = new FakeClient({ 'SELECT confirmed_at FROM admin_totp_enrollments': empty() })
    setDatabasePoolForTests(pool(client))
    assert.deepEqual(await getAdminTotpStatus(ADMIN_ID), { enrolled: false, confirmed: false })
  })
})

describe('user management', () => {
  it('lists users with search and count', async () => {
    const user = { id: USER_ID, username: 'alice', email: 'a@example.com', session_count: 2 }
    const client = new FakeClient({ 'COUNT(*)::int AS total': row({ total: 1 }), 'FROM users WHERE': row(user) })
    setDatabasePoolForTests(pool(client))
    const result = await listUsers({ search: 'alice', limit: 20, offset: 0 })
    assert.equal(result.total, 1)
    assert.equal(result.users[0].username, 'alice')
  })

  it('returns user detail with project counts and storage', async () => {
    const client = new FakeClient({ 'FROM users u LEFT JOIN projects': row({ id: USER_ID, username: 'alice', owned_projects: 2, shared_projects: 1, logical_storage: 4096 }) })
    setDatabasePoolForTests(pool(client))
    const user = await getUser(USER_ID)
    assert.equal(user.owned_projects, 2)
    assert.equal(user.logical_storage, 4096)
  })

  it('returns null for a missing user', async () => {
    const client = new FakeClient({ 'FROM users u LEFT JOIN projects': empty() })
    setDatabasePoolForTests(pool(client))
    assert.equal(await getUser(USER_ID), null)
  })

  it('suspends a user, revokes sessions, and audits', async () => {
    const client = new FakeClient()
    setDatabasePoolForTests(pool(client))
    await suspendUser(USER_ID, ADMIN_ID)
    assert.ok(client.calls.some((c) => c.sql.includes('UPDATE users SET suspended_at')))
    assert.ok(client.calls.some((c) => c.sql.includes('DELETE FROM sessions')))
    assert.ok(auditHas(client, 'admin.user.suspend'))
  })

  it('unsuspends a user and audits', async () => {
    const client = new FakeClient()
    setDatabasePoolForTests(pool(client))
    await unsuspendUser(USER_ID, ADMIN_ID)
    assert.ok(client.calls.some((c) => c.sql.includes('SET suspended_at = NULL')))
    assert.ok(auditHas(client, 'admin.user.unsuspend'))
  })

  it('verifies a user email and audits', async () => {
    const client = new FakeClient()
    setDatabasePoolForTests(pool(client))
    await verifyUserEmail(USER_ID, ADMIN_ID)
    assert.ok(client.calls.some((c) => c.sql.includes('SET email_verified_at = NOW()')))
    assert.ok(auditHas(client, 'admin.user.verify_email'))
  })

  it('refuses to unverify an email for a project owner', async () => {
    const client = new FakeClient({ 'SELECT COUNT(*)::int AS project_count FROM projects': row({ project_count: 1 }) })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(unverifyUserEmail(USER_ID, ADMIN_ID), AdminSecurityError)
    assert.ok(!client.calls.some((c) => c.sql.includes('SET email_verified_at = NULL')))
  })

  it('unverifies an email for a user with no projects', async () => {
    const client = new FakeClient({ 'SELECT COUNT(*)::int AS project_count FROM projects': row({ project_count: 0 }) })
    setDatabasePoolForTests(pool(client))
    await unverifyUserEmail(USER_ID, ADMIN_ID)
    assert.ok(client.calls.some((c) => c.sql.includes('SET email_verified_at = NULL')))
    assert.ok(auditHas(client, 'admin.user.unverify_email'))
  })

  it('revokes all user sessions and records the count', async () => {
    const client = new FakeClient({ 'SELECT COUNT(*)::int AS count FROM sessions': row({ count: 3 }) })
    setDatabasePoolForTests(pool(client))
    await revokeAllUserSessions(USER_ID, ADMIN_ID)
    assert.ok(client.calls.some((c) => c.sql.includes('DELETE FROM sessions WHERE user_id')))
    assert.ok(auditHas(client, 'admin.user.sessions_revoke_all'))
  })

  it('removes a membership and cleans up assignments', async () => {
    const client = new FakeClient({ 'SELECT user_id FROM project_memberships': row({ user_id: 'member-1' }) })
    setDatabasePoolForTests(pool(client))
    await removeUserProjectMembership(PROJECT_ID, USER_ID, ADMIN_ID)
    assert.ok(client.calls.some((c) => c.sql.includes('DELETE FROM project_memberships')))
    assert.ok(auditHas(client, 'admin.project.member_remove'))
  })

  it('refuses to remove a missing membership', async () => {
    const client = new FakeClient({ 'SELECT user_id FROM project_memberships': empty() })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(removeUserProjectMembership(PROJECT_ID, USER_ID, ADMIN_ID), AdminSecurityError)
  })

  it('refuses to delete a user who owns projects without the flag', async () => {
    const client = new FakeClient({
      'SELECT id, email FROM users': row({ id: USER_ID, email: 'a@example.com' }),
      'SELECT id FROM projects WHERE owner_user_id': row({ id: PROJECT_ID }),
    })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(deleteUser(USER_ID, false, ADMIN_ID), AdminSecurityError)
    assert.ok(client.calls.some((c) => c.sql === 'ROLLBACK'))
  })

  it('deletes a user and their owned projects transactionally', async () => {
    const client = new FakeClient({
      'SELECT id, email FROM users': row({ id: USER_ID, email: 'a@example.com' }),
      'SELECT id FROM projects WHERE owner_user_id': row({ id: PROJECT_ID }),
    })
    setDatabasePoolForTests(pool(client))
    await deleteUser(USER_ID, true, ADMIN_ID)
    assert.equal(client.calls[0].sql, 'BEGIN')
    assert.ok(client.calls.some((c) => c.sql === 'COMMIT'))
    assert.ok(client.calls.some((c) => c.sql.includes('DELETE FROM projects WHERE owner_user_id')))
    assert.ok(client.calls.some((c) => c.sql.includes('DELETE FROM users WHERE id')))
    assert.equal(client.released, true)
  })

  it('rolls back a user deletion when a step fails', async () => {
    const client = new FakeClient({
      'SELECT id, email FROM users': row({ id: USER_ID, email: 'a@example.com' }),
      'SELECT id FROM projects WHERE owner_user_id': row({ id: PROJECT_ID }),
      'DELETE FROM projects WHERE owner_user_id': { error: new Error('fk failure') },
    })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(deleteUser(USER_ID, true, ADMIN_ID), /fk failure/)
    assert.ok(client.calls.some((c) => c.sql === 'ROLLBACK'))
    assert.equal(client.released, true)
  })
})

describe('project management', () => {
  it('lists projects with owner and count', async () => {
    const project = { id: PROJECT_ID, name: 'Game', owner_username: 'alice', member_count: 1, entry_count: 5, logical_size: 128 }
    const client = new FakeClient({ 'COUNT(*)::int AS total': row({ total: 1 }), 'FROM projects p INNER JOIN users u': row(project) })
    setDatabasePoolForTests(pool(client))
    const result = await listProjects({})
    assert.equal(result.total, 1)
    assert.equal(result.projects[0].name, 'Game')
  })

  it('returns project detail with members', async () => {
    const client = new FakeClient({
      'FROM projects p INNER JOIN users u ON u.id = p.owner_user_id WHERE p.id': row({ id: PROJECT_ID, name: 'Game', owner_id: ADMIN_ID, owner_username: 'operator' }),
      'FROM project_memberships pm INNER JOIN users u': row({ id: USER_ID, username: 'alice', role: 'editor' }),
    })
    setDatabasePoolForTests(pool(client))
    const project = await getProject(PROJECT_ID)
    assert.equal(project.members.length, 1)
    assert.equal(project.members[0].role, 'editor')
  })

  it('rejects an invalid member role', async () => {
    const client = new FakeClient()
    setDatabasePoolForTests(pool(client))
    await assert.rejects(changeProjectMemberRole(PROJECT_ID, USER_ID, 'admin', ADMIN_ID), AdminSecurityError)
  })

  it('refuses to change the owner role', async () => {
    const client = new FakeClient({ 'SELECT owner_user_id FROM projects': row({ owner_user_id: USER_ID }) })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(changeProjectMemberRole(PROJECT_ID, USER_ID, 'editor', ADMIN_ID), AdminSecurityError)
  })

  it('changes a member role and audits', async () => {
    const client = new FakeClient({ 'SELECT owner_user_id FROM projects': row({ owner_user_id: ADMIN_ID }) })
    setDatabasePoolForTests(pool(client))
    await changeProjectMemberRole(PROJECT_ID, USER_ID, 'viewer', ADMIN_ID)
    assert.ok(client.calls.some((c) => c.sql.includes("UPDATE project_memberships SET role")))
    assert.ok(auditHas(client, 'admin.project.member_role_change'))
  })

  it('refuses ownership transfer to a missing user', async () => {
    const client = new FakeClient({ 'SELECT owner_user_id FROM projects': row({ owner_user_id: ADMIN_ID }), 'SELECT id FROM users WHERE id': empty() })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(transferProjectOwnership(PROJECT_ID, USER_ID, ADMIN_ID), AdminSecurityError)
  })

  it('transfers ownership and audits', async () => {
    const client = new FakeClient({ 'SELECT owner_user_id FROM projects': row({ owner_user_id: ADMIN_ID }), 'SELECT id FROM users WHERE id': row({ id: USER_ID }) })
    setDatabasePoolForTests(pool(client))
    await transferProjectOwnership(PROJECT_ID, USER_ID, ADMIN_ID)
    assert.ok(client.calls.some((c) => c.sql.includes('UPDATE projects SET owner_user_id')))
    assert.ok(auditHas(client, 'admin.project.ownership_transfer'))
  })

  it('deletes a project transactionally', async () => {
    const client = new FakeClient({ 'SELECT id FROM projects WHERE id': row({ id: PROJECT_ID }) })
    setDatabasePoolForTests(pool(client))
    await deleteProject(PROJECT_ID, ADMIN_ID)
    assert.equal(client.calls[0].sql, 'BEGIN')
    assert.ok(client.calls.some((c) => c.sql === 'COMMIT'))
    assert.ok(client.calls.some((c) => c.sql.includes('DELETE FROM projects WHERE id')))
    assert.ok(auditHas(client, 'admin.project.delete'))
    assert.equal(client.released, true)
  })

  it('rolls back project deletion on failure', async () => {
    const client = new FakeClient({ 'SELECT id FROM projects WHERE id': row({ id: PROJECT_ID }), 'DELETE FROM projects WHERE id': { error: new Error('fk failure') } })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(deleteProject(PROJECT_ID, ADMIN_ID), /fk failure/)
    assert.ok(client.calls.some((c) => c.sql === 'ROLLBACK'))
    assert.equal(client.released, true)
  })
})

describe('sessions, storage, metrics, audit', () => {
  it('lists a user sessions', async () => {
    const client = new FakeClient({ 'FROM sessions WHERE user_id': row({ token_hash: 'hash1', expires_at: '2026-08-26T00:00:00Z' }) })
    setDatabasePoolForTests(pool(client))
    const sessions = await listUserSessions(USER_ID)
    assert.equal(sessions.length, 1)
  })

  it('revokes a single session', async () => {
    const client = new FakeClient()
    setDatabasePoolForTests(pool(client))
    await revokeSession('hash1')
    assert.ok(client.calls.some((c) => c.sql.includes('DELETE FROM sessions WHERE token_hash')))
  })

  it('returns platform metrics', async () => {
    const client = new FakeClient({ 'AS logical_storage': row({ total_users: 10, verified_users: 7, total_projects: 3, active_sessions: 4, logical_storage: 2048 }) })
    setDatabasePoolForTests(pool(client))
    const metrics = await getPlatformMetrics()
    assert.equal(metrics.total_users, 10)
    assert.equal(metrics.logical_storage, 2048)
  })

  it('returns per-user storage breakdown', async () => {
    const client = new FakeClient({ 'AS owned_storage': row({ owned_storage: 512, owned_projects: [{ projectId: PROJECT_ID, projectName: 'Game', bytes: 512 }] }) })
    setDatabasePoolForTests(pool(client))
    const storage = await getStorageBreakdown(USER_ID)
    assert.equal(storage.owned_storage, 512)
    assert.equal(storage.owned_projects.length, 1)
  })

  it('lists the audit log with pagination and action filter', async () => {
    const client = new FakeClient({
      'FROM admin_audit_log a': row({ id: 'log-1', action: 'admin.user.suspend', admin_username: 'operator', success: true }),
      'COUNT(*)::int AS total FROM admin_audit_log': row({ total: 1 }),
    })
    setDatabasePoolForTests(pool(client))
    const result = await listAuditLog({ limit: 50, offset: 0, action: 'admin.user.suspend' })
    assert.equal(result.total, 1)
    assert.equal(result.logs[0].action, 'admin.user.suspend')
  })

  it('returns recent activity', async () => {
    const client = new FakeClient({ 'FROM admin_audit_log a': row({ id: 'log-1', action: 'admin.user.suspend', admin_username: 'operator' }) })
    setDatabasePoolForTests(pool(client))
    const activity = await getRecentActivity(10)
    assert.equal(activity.length, 1)
  })
})
