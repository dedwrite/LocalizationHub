// Verify the production Super Admin has no lingering TOTP enrollment after
// rotation. Prints only counts, never key material.
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

const enrollment = await pool.query('SELECT COUNT(*)::int AS n FROM admin_totp_enrollments WHERE user_id = $1', [userId])
const activeSessions = await pool.query('SELECT COUNT(*)::int AS n FROM admin_sessions WHERE user_id = $1 AND revoked_at IS NULL', [userId])

console.log(JSON.stringify({
  username,
  siteRole: account.rows[0].site_role,
  enrollmentRowsRemaining: enrollment.rows[0].n,
  activeAdminSessions: activeSessions.rows[0].n,
}))
await pool.end()
