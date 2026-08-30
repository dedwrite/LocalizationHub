import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'

export const testUsers = {
  owner: '22222222-2222-4222-8222-222222222222',
  editor: '33333333-3333-4333-8333-333333333333',
  viewer: '44444444-4444-4444-8444-444444444444',
  outsider: '55555555-5555-4555-8555-555555555555',
}
export const testToken = (role) => role === 'owner' ? 'synthetic-lifecycle-token' : `synthetic-${role}-token`

/** Real PostgreSQL in isolated WASM memory; no TCP connection, local env file
 * or production DATABASE_URL. Run actual migrations and FK/transaction logic.
 */
export async function createProjectTestDatabase(onWrite = () => {}) {
  const db = new PGlite()
  const migrations = new URL('../../migrations/', import.meta.url)
  for (const file of (await readdir(migrations)).filter((file) => file.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, migrations), 'utf8'))
  }
  for (const [role, id] of Object.entries(testUsers)) {
    await db.query('INSERT INTO users (id, username, email, password_salt, password_hash, email_verified_at) VALUES ($1,$2,$3,$4,$5,NOW())', [id, `test_${role}`, `${role}@example.invalid`, 'synthetic', 'synthetic'])
    await db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,NOW() + INTERVAL '1 day')", [createHash('sha256').update(testToken(role)).digest('hex'), id])
  }
  // PGlite has one connection. Serialize entire transactions, not individual
  // queries, so concurrent HTTP reads cannot enter another request's BEGIN.
  let tail = Promise.resolve()
  async function acquire() {
    let release
    const prior = tail
    tail = new Promise((resolve) => { release = resolve })
    await prior
    return release
  }
  async function query(sql, params = []) {
    const result = await db.query(sql, params)
    if (/^(INSERT INTO projects|UPDATE projects)/u.test(sql.trim()) && result.rows[0]?.project) onWrite(result.rows[0])
    return { ...result, rowCount: result.affectedRows ?? result.rows.length }
  }
  const pool = {
    async connect() { const release = await acquire(); return { query, release } },
    async query(sql, params) { const release = await acquire(); try { return await query(sql, params) } finally { release() } },
  }
  return { db, pool, close: () => db.close() }
}
