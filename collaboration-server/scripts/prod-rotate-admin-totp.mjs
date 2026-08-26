// Production Admin TOTP rotation — invalidates the current enrollment secret
// and revokes any admin sessions for the intended Super Admin only.
// Preserves the normal account and site_role. Prints no key material.
import { loadEnvFile } from 'node:process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url))
if (!existsSync(envPath)) throw new Error('.env.local not found')
loadEnvFile(envPath)

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL not set in .env.local')

const username = process.env.LH_SUPER_ADMIN_USERNAME?.trim().toLowerCase()
if (!username) throw new Error('LH_SUPER_ADMIN_USERNAME is required')

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

const account = await pool.query('SELECT id, site_role FROM users WHERE username = $1', [username])
if (!account.rowCount) throw new Error(`Account not found: ${username}`)
const userId = account.rows[0].id
const siteRole = account.rows[0].site_role

// 1. Invalidate the current TOTP enrollment secret (delete the row so the
//    next beginTotpEnrollment generates a brand-new random secret).
const enrollment = await pool.query('DELETE FROM admin_totp_enrollments WHERE user_id = $1', [userId])

// 2. Revoke any admin sessions created from the compromised enrollment.
const sessions = await pool.query('UPDATE admin_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId])

console.log(JSON.stringify({
  rotated: true,
  username,
  siteRole,
  enrollmentRowsRemoved: enrollment.rowCount,
  adminSessionsRevoked: sessions.rowCount,
}))

await pool.end()
