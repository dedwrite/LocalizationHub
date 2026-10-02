import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { resetDatabasePoolForTests, setDatabasePoolForTests } from '../database.mjs'
import { AccountDeletionError, deleteOwnAccount, revokeDeletedAccountSessions } from '../account-deletion.mjs'

const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROJECT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ADDRESS = 'owner@example.invalid'

function rows(list) { return { rows: list, rowCount: list.length } }
function row(value) { return rows([value]) }
function empty() { return rows([]) }

class FakeClient {
  constructor(handlers = {}) {
    this.handlers = handlers
    this.calls = []
    this.released = false
  }
  async query(sql, params) {
    this.calls.push({ sql, params })
    if (/^(BEGIN|COMMIT|ROLLBACK)$/u.test(sql.trim())) return empty()
    for (const [needle, handler] of Object.entries(this.handlers)) {
      if (!sql.includes(needle)) continue
      const result = typeof handler === 'function' ? handler(sql, params) : handler
      if (result?.error) throw result.error
      return result
    }
    return empty()
  }
  release() { this.released = true }
}
function pool(client) { return { connect: async () => client, query: (...args) => client.query(...args) } }
const account = { 'SELECT id, email FROM users': row({ id: USER_ID, email: ADDRESS }) }
const ownsProject = { 'SELECT id FROM projects WHERE owner_user_id': row({ id: PROJECT_ID }) }
const ownsNothing = { 'SELECT id FROM projects WHERE owner_user_id': empty() }
const auditInsert = (client) => client.calls.find((call) => call.sql.includes('INSERT INTO admin_audit_log'))

afterEach(() => resetDatabasePoolForTests())

describe('self-service account deletion', () => {
  it('refuses an account that still owns Cloud Projects and commits nothing', async () => {
    const client = new FakeClient({ ...account, ...ownsProject })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(deleteOwnAccount(USER_ID), (error) => error instanceof AccountDeletionError && error.code === 'user-has-projects')
    assert.equal(client.calls.some((call) => call.sql === 'COMMIT'), false)
    assert.equal(client.calls.at(-1).sql, 'ROLLBACK')
    assert.equal(client.released, true)
  })

  it('reports a missing account instead of deleting another one', async () => {
    const client = new FakeClient({ 'SELECT id, email FROM users': empty() })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(deleteOwnAccount(USER_ID), (error) => error instanceof AccountDeletionError && error.code === 'user-not-found')
    assert.equal(client.calls.some((call) => call.sql.includes('DELETE FROM users WHERE id')), false)
    assert.equal(client.calls.at(-1).sql, 'ROLLBACK')
  })

  it('deletes the account, its owned projects, and its sessions in one transaction', async () => {
    const client = new FakeClient({ ...account, ...ownsProject })
    setDatabasePoolForTests(pool(client))
    assert.deepEqual(await deleteOwnAccount(USER_ID, { deleteOwnedProjects: true }), { deleted: true, projects: 1, projectIds: [PROJECT_ID] })
    assert.equal(client.calls[0].sql, 'BEGIN')
    assert.equal(client.calls.at(-1).sql, 'COMMIT')
    for (const statement of ['DELETE FROM projects WHERE owner_user_id', 'DELETE FROM project_memberships WHERE project_id', 'DELETE FROM sessions WHERE user_id', 'DELETE FROM admin_sessions WHERE user_id', 'DELETE FROM email_verification_tokens WHERE user_id', 'DELETE FROM users WHERE id']) {
      assert.ok(client.calls.some((call) => call.sql.includes(statement)), `missing ${statement}`)
    }
    const audit = auditInsert(client)
    assert.ok(audit.sql.includes('NULL'))
    assert.deepEqual(audit.params, [USER_ID, JSON.stringify({ deleted_projects: 1 })])
    assert.equal(client.released, true)
  })

  it('keeps shared projects standing while removing the membership and its assignments', async () => {
    const client = new FakeClient({ ...account, ...ownsNothing, 'SELECT project_id FROM project_memberships WHERE user_id': row({ project_id: PROJECT_ID }) })
    setDatabasePoolForTests(pool(client))
    assert.deepEqual(await deleteOwnAccount(USER_ID), { deleted: true, projects: 0, projectIds: [] })
    assert.ok(client.calls.some((call) => call.sql.includes('DELETE FROM project_memberships WHERE user_id')))
    assert.ok(client.calls.some((call) => call.sql.includes('DELETE FROM project_assignments WHERE project_id = $1 AND user_id = $2')))
    assert.equal(client.calls.some((call) => call.sql.includes('DELETE FROM projects WHERE owner_user_id')), false)
    assert.deepEqual(auditInsert(client).params, [USER_ID, JSON.stringify({ deleted_projects: 0 })])
  })

  it('rolls back the whole deletion and releases the client when a step fails', async () => {
    const client = new FakeClient({ ...account, ...ownsProject, 'DELETE FROM projects WHERE owner_user_id': { error: new Error('synthetic failure') } })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(deleteOwnAccount(USER_ID, { deleteOwnedProjects: true }), /synthetic failure/)
    assert.equal(client.calls.some((call) => call.sql === 'COMMIT'), false)
    assert.equal(client.calls.at(-1).sql, 'ROLLBACK')
    assert.equal(auditInsert(client), undefined)
    assert.equal(client.released, true)
  })
})

describe('account deletion live sessions', () => {
  const room = (sessionId, sockets) => [sessionId, { sessionId, sockets: new Set(sockets) }]

  it('ends only the deleted account sockets and leaves other members connected', () => {
    const mine = {}
    const theirs = {}
    const sessions = new Map([room('one', [mine, theirs]), room('two', [theirs])])
    const cleared = []
    const errors = []
    revokeDeletedAccountSessions(sessions, USER_ID, (socket) => socket === mine ? USER_ID : 'other-user', (socket) => cleared.push(socket), (socket, code) => errors.push({ socket, code }))
    assert.deepEqual(cleared, [mine])
    assert.deepEqual(errors, [{ socket: mine, code: 'account-deleted' }])
    assert.equal(sessions.get('one').sockets.has(theirs), true)
    assert.equal(sessions.size, 2)
  })

  it('drops a room once the deleted account was its last socket', () => {
    const mine = {}
    const sessions = new Map([room('one', [mine])])
    revokeDeletedAccountSessions(sessions, USER_ID, () => USER_ID, () => {}, () => {})
    assert.equal(sessions.size, 0)
  })
})
