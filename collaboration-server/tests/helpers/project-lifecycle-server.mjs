// Actual HTTP/auth/validation/storage handlers with isolated PostgreSQL/WASM.
// Never loads a local env file or opens a production database connection.
import { setDatabasePoolForTests } from '../../database.mjs'
import { createProjectTestDatabase } from './project-database.mjs'

if (process.env.NODE_ENV !== 'test') throw new Error('Test server requires NODE_ENV=test')
process.env.ENABLE_EXPERIMENTAL_CLOUD_API = '1'
process.env.SERVE_PUBLIC_WEBSITE = '1'
process.env.HOST = '127.0.0.1'
delete process.env.DATABASE_URL

const database = await createProjectTestDatabase((row) => process.send?.({ type: 'persisted', id: row.id, project: row.project }))
setDatabasePoolForTests(database.pool)
await import('../../server.mjs')
