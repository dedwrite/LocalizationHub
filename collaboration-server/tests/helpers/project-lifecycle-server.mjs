// Test-only SQL adapter. The real HTTP/auth/validation/project handlers run;
// only PostgreSQL I/O is replaced. Never loads local or production env files.
import { createHash } from 'node:crypto'
import { setDatabasePoolForTests } from '../../database.mjs'

if (process.env.NODE_ENV !== 'test') throw new Error('Test server requires NODE_ENV=test')
process.env.ENABLE_EXPERIMENTAL_CLOUD_API = '1'
process.env.SERVE_PUBLIC_WEBSITE = '1'
process.env.HOST = '127.0.0.1'
delete process.env.DATABASE_URL

const userId = '22222222-2222-4222-8222-222222222222'
const tokenHash = createHash('sha256').update('synthetic-lifecycle-token').digest('hex')
const projects = new Map()
const clone = (value) => JSON.parse(JSON.stringify(value))
const rows = (values = []) => ({ rows: clone(values), rowCount: values.length })
const pool = {
  async connect() { return { query: pool.query, release() {} } },
  async query(sql, params = []) {
    if (/FROM sessions s/u.test(sql)) return rows(params[0] === tokenHash ? [{ id: userId, username: 'tester', email: 'test@example.com', email_verified_at: '2026-01-01', created_at: '2026-01-01', expires_at: '2099-01-01', site_role: 'user' }] : [])
    if (/INSERT INTO projects \(/u.test(sql)) {
      const [id, owner_user_id, name, encoded] = params
      const project = JSON.parse(encoded)
      const row = { id, owner_user_id, name, project, revision: 1, role: 'owner', updated_at: new Date().toISOString() }
      projects.set(id, row)
      process.send?.({ type: 'persisted', id, project: clone(project) })
      return rows([row])
    }
    if (/UPDATE projects\s+SET\s+project/u.test(sql)) {
      const [id, actor, encoded, revision] = params
      const row = projects.get(id)
      if (!row || row.owner_user_id !== actor || row.revision !== revision) return rows()
      row.project = JSON.parse(encoded)
      row.revision++
      process.send?.({ type: 'persisted', id, project: clone(row.project) })
      return rows([row])
    }
    if (/jsonb_array_length/u.test(sql)) return rows([...projects.values()].map((row) => ({ ...row, source_file_name: row.project.sourceFileName, entry_count: row.project.entries.length, translated_count: row.project.entries.filter((entry) => entry.translation).length, member_count: 0 })))
    if (/FROM projects/u.test(sql)) {
      const row = projects.get(params[0])
      return rows(row ? [row] : [])
    }
    if (/^(BEGIN|COMMIT|ROLLBACK|SET TRANSACTION)/u.test(sql) || /project_(activity|assignments|comments|memberships)/u.test(sql)) return rows()
    throw new Error('Unexpected query in isolated project test adapter')
  },
}
setDatabasePoolForTests(pool)
await import('../../server.mjs')
