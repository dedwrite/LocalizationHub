import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import { getDatabasePool } from './database.mjs'

const ADMIN_SESSION_TTL_MS = 60 * 60 * 1000
const ADMIN_IDLE_TTL_MS = 20 * 60 * 1000
const ADMIN_EMAIL_TTL_MS = 5 * 60 * 1000
const TOTP_PERIOD_SECONDS = 30
const TOTP_DIGITS = 6

export class AdminSecurityError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AdminSecurityError'
    this.code = code
  }
}

function securityKey() {
  const value = process.env.ADMIN_SECURITY_KEY?.trim()
  if (!value) throw new AdminSecurityError('admin-security-unconfigured', 'Admin security is not configured.')
  return createHash('sha256').update(value, 'utf8').digest()
}
function hash(value) { return createHash('sha256').update(value, 'utf8').digest('hex') }
function equalHex(left, right) {
  const a = Buffer.from(left, 'hex'); const b = Buffer.from(right, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
function encryptSecret(secret) {
  const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', securityKey(), nonce)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return { encryptedSecret: encrypted.toString('base64url'), nonce: nonce.toString('base64url'), authTag: cipher.getAuthTag().toString('base64url') }
}
function decryptSecret(row) {
  const decipher = createDecipheriv('aes-256-gcm', securityKey(), Buffer.from(row.nonce, 'base64url'))
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_secret, 'base64url')), decipher.final()]).toString('utf8')
}
function base32Decode(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const char of value.replace(/=+$/, '').toUpperCase()) { const index = alphabet.indexOf(char); if (index < 0) throw new AdminSecurityError('totp-invalid', 'TOTP secret is invalid.'); bits += index.toString(2).padStart(5, '0') }
  const bytes = []; for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2)); return Buffer.from(bytes)
}
function hotp(secret, counter) { const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(counter)); const hmac = createHmac('sha1', secret).update(buffer).digest(); const offset = hmac[hmac.length - 1] & 15; return String(((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000)).padStart(6, '0') }
export function generateTotpSecret() { return randomBytes(20).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '') }
export function totpCode(secret, timestamp = Date.now()) { return hotp(Buffer.from(secret, 'base64url'), Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS)) }
export function verifyTotp(secret, code, timestamp = Date.now()) { if (!/^\d{6}$/.test(code ?? '')) return false; for (const drift of [-1, 0, 1]) { if (equalHex(hash(hotp(Buffer.from(secret, 'base64url'), Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS) + drift)), hash(code))) return true } return false }
export function otpauthUri(secret, username) { return `otpauth://totp/LocalizationHub:${encodeURIComponent(username)}?secret=${secret}&issuer=LocalizationHub&algorithm=SHA1&digits=6&period=30` }

export async function bootstrapSuperAdmin(username) {
  if (!username?.trim()) throw new AdminSecurityError('bootstrap-username-required', 'LH_SUPER_ADMIN_USERNAME is required.')
  const database = getDatabasePool(); const result = await database.query("UPDATE users SET site_role = 'super_admin' WHERE username = $1 AND email_verified_at IS NOT NULL RETURNING id, username", [username.trim().toLowerCase()])
  if (!result.rowCount) throw new AdminSecurityError('bootstrap-account-not-found', 'The verified bootstrap account was not found.')
  return result.rows[0]
}
export async function getSuperAdmin(userId) { const result = await getDatabasePool().query("SELECT id, username, email, email_verified_at, site_role, suspended_at FROM users WHERE id = $1 AND site_role = 'super_admin'", [userId]); return result.rows[0] ?? null }
export async function requestAdminEmailCode(userId) { const database = getDatabasePool(); const user = await getSuperAdmin(userId); if (!user) throw new AdminSecurityError('admin-forbidden', 'Super Admin access is required.'); const code = String(randomInt(0, 1000000)).padStart(6, '0'); await database.query('UPDATE admin_email_challenges SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]); await database.query('INSERT INTO admin_email_challenges (id, user_id, code_hash, expires_at) VALUES ($1, $2, $3, $4)', [randomUUID(), userId, hash(code), new Date(Date.now() + ADMIN_EMAIL_TTL_MS)]); return { user, code }
}
export async function verifyAdminEmailCode(userId, code) { const database = getDatabasePool(); const result = await database.query('SELECT id, code_hash, attempts, expires_at FROM admin_email_challenges WHERE user_id = $1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1', [userId]); const row = result.rows[0]; if (!row || new Date(row.expires_at).getTime() <= Date.now() || row.attempts >= 10) throw new AdminSecurityError('admin-email-invalid', 'The Admin email code is invalid or expired.'); if (!equalHex(row.code_hash, hash(code))) { await database.query('UPDATE admin_email_challenges SET attempts = attempts + 1 WHERE id = $1', [row.id]); throw new AdminSecurityError('admin-email-invalid', 'The Admin email code is invalid or expired.') } await database.query('UPDATE admin_email_challenges SET used_at = NOW() WHERE id = $1', [row.id]); return true }
export async function beginTotpEnrollment(userId, username) { const existing = await getDatabasePool().query('SELECT confirmed_at FROM admin_totp_enrollments WHERE user_id = $1', [userId]); if (existing.rows[0]?.confirmed_at) throw new AdminSecurityError('totp-already-enrolled', 'TOTP is already enrolled.'); const secret = generateTotpSecret(); const encrypted = encryptSecret(secret); await getDatabasePool().query('INSERT INTO admin_totp_enrollments (user_id, encrypted_secret, nonce, auth_tag) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET encrypted_secret = EXCLUDED.encrypted_secret, nonce = EXCLUDED.nonce, auth_tag = EXCLUDED.auth_tag, enrolled_at = NOW(), confirmed_at = NULL', [userId, encrypted.encryptedSecret, encrypted.nonce, encrypted.authTag]); return { secret, uri: otpauthUri(secret, username) }
}
export async function verifyAdminTotp(userId, code) { const result = await getDatabasePool().query('SELECT encrypted_secret, nonce, auth_tag, confirmed_at FROM admin_totp_enrollments WHERE user_id = $1', [userId]); if (!result.rowCount) throw new AdminSecurityError('totp-not-enrolled', 'TOTP enrollment is required.'); if (!verifyTotp(decryptSecret(result.rows[0]), code)) throw new AdminSecurityError('totp-invalid', 'The TOTP code is invalid.'); if (!result.rows[0].confirmed_at) await getDatabasePool().query('UPDATE admin_totp_enrollments SET confirmed_at = NOW() WHERE user_id = $1', [userId]); return true }
export async function createAdminSession(userId) { const token = randomBytes(32).toString('base64url'); const now = new Date(); await getDatabasePool().query('INSERT INTO admin_sessions (token_hash, user_id, expires_at, recent_totp_at) VALUES ($1, $2, $3, $4)', [hash(token), userId, new Date(now.getTime() + ADMIN_SESSION_TTL_MS), now]); return token }
export async function authenticateAdminSession(token, userId) { if (!token || !userId) return null; const result = await getDatabasePool().query("SELECT s.user_id, s.last_used_at, s.expires_at, u.site_role, u.suspended_at FROM admin_sessions s INNER JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.user_id = $2 AND s.revoked_at IS NULL", [hash(token), userId]); const row = result.rows[0]; if (!row || row.site_role !== 'super_admin' || row.suspended_at || new Date(row.expires_at).getTime() <= Date.now() || new Date(row.last_used_at).getTime() + ADMIN_IDLE_TTL_MS <= Date.now()) return null; await getDatabasePool().query('UPDATE admin_sessions SET last_used_at = NOW() WHERE token_hash = $1', [hash(token)]); return row }
export async function revokeAdminSession(token) { if (token) await getDatabasePool().query('UPDATE admin_sessions SET revoked_at = NOW() WHERE token_hash = $1', [hash(token)]) }
export async function writeAdminAudit({ adminUserId, action, targetType = null, targetId = null, success, metadata = {}, requestIp = null, userAgent = null }) { await getDatabasePool().query('INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, success, metadata, request_ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)', [adminUserId, action, targetType, targetId, success, JSON.stringify(metadata), requestIp, userAgent]) }
export async function requireRecentTotp(token, userId) { const result = await getDatabasePool().query('SELECT recent_totp_at FROM admin_sessions WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL', [hash(token), userId]); if (!result.rows[0]?.recent_totp_at || new Date(result.rows[0].recent_totp_at).getTime() + 5 * 60 * 1000 < Date.now()) throw new AdminSecurityError('recent-totp-required', 'Recent TOTP confirmation is required.'); return true }
