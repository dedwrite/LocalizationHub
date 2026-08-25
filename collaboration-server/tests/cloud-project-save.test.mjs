import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { resetDatabasePoolForTests, setDatabasePoolForTests } from '../database.mjs'
import { CloudProjectConflictError, CloudProjectMemberNotFoundError, CloudProjectOwnerImmutableError, CloudProjectNotFoundError, CloudProjectPermissionError, removeCloudProjectMember, saveCloudProject } from '../cloud-projects.mjs'

const projectId = '11111111-1111-4111-8111-111111111111'
const ownerId = '22222222-2222-4222-8222-222222222222'
const editorId = '33333333-3333-4333-8333-333333333333'
const project = { format: 'LocalizationHubProject', version: 3, sourceFileName: 'x.json', entries: [{ id: 'entry-1', translation: 'new' }], workflow: { entries: { 'entry-1': { status: 'approved' } } } }
const oldProject = structuredClone(project); oldProject.entries[0].translation = 'old'; oldProject.workflow.entries['entry-1'].status = 'draft'
class FakeClient { constructor(steps) { this.steps = [...steps]; this.calls = []; this.released = false } async query(sql, params) { this.calls.push({ sql, params }); if (/^(BEGIN|COMMIT|ROLLBACK|SET TRANSACTION ISOLATION LEVEL REPEATABLE READ)$/u.test(sql)) return { rows: [], rowCount: 0 }; const step = this.steps.shift(); if (!step) throw new Error(`Unexpected query: ${sql}`); if (step.error) throw step.error; return step } release() { this.released = true } }
function pool(client) { return { connect: async () => client, query: (...args) => client.query(...args) } }
function result(value, rowCount = 1) { return { rows: rowCount ? [value] : [], rowCount } }
function access(role = 'owner', value = oldProject) { return result({ id: projectId, name: 'Project', revision: 3, updated_at: '2026-08-25T00:00:00Z', project: value, role, owner_user_id: ownerId }) }
function saved(value = project) { return result({ id: projectId, name: 'Project', revision: 4, updated_at: '2026-08-25T00:00:00Z', project: value, role: 'owner' }) }

afterEach(() => resetDatabasePoolForTests())

describe('saveCloudProject transaction and writer authorization', () => {
  it('saves for owner and commits project plus activity transactionally', async () => { const client = new FakeClient([result({ project: oldProject }), saved(), result({}, 0), result({}, 0)]); setDatabasePoolForTests(pool(client)); const snapshot = await saveCloudProject(projectId, { userId: ownerId, project, baseRevision: 3 }); assert.equal(snapshot.revision, 4); assert.equal(client.calls[0].sql, 'BEGIN'); assert.equal(client.calls.at(-1).sql, 'COMMIT'); assert.equal(client.released, true); assert.match(client.calls[1].sql, /owner_user_id = \$3/) })
  it('saves for editor and records workflow activity', async () => { const client = new FakeClient([result({ project: oldProject }), saved(), result({}, 0), result({}, 0)]); setDatabasePoolForTests(pool(client)); await saveCloudProject(projectId, { userId: editorId, project, baseRevision: 3 }); assert.equal(client.calls.at(-1).sql, 'COMMIT'); assert.ok(client.calls.some((call) => call.sql.includes("'workflow-changed'"))) })
  it('does not lock or update for viewer or outsider', async () => { for (const [role, expected] of [['viewer', CloudProjectPermissionError], [null, CloudProjectNotFoundError]]) { const client = new FakeClient([result({}, 0), result({}, 0), role ? access(role) : result({}, 0)]); setDatabasePoolForTests(pool(client)); await assert.rejects(saveCloudProject(projectId, { userId: editorId, project, baseRevision: 3 }), expected); assert.match(client.calls[1].sql, /owner_user_id = \$3/); assert.equal(client.calls.at(-1).sql, 'ROLLBACK'); resetDatabasePoolForTests() } })
  it('returns stale revision conflict for an authorized writer', async () => { const client = new FakeClient([result({}, 0), result({}, 0), access('editor')]); setDatabasePoolForTests(pool(client)); await assert.rejects(saveCloudProject(projectId, { userId: editorId, project, baseRevision: 2 }), CloudProjectConflictError); assert.equal(client.calls.at(-1).sql, 'ROLLBACK') })
  it('creates no activity for an unchanged project', async () => { const client = new FakeClient([result({ project }), saved()]); setDatabasePoolForTests(pool(client)); await saveCloudProject(projectId, { userId: ownerId, project, baseRevision: 3 }); assert.equal(client.calls.filter((call) => call.sql.includes('project_activity')).length, 0) })
  it('rolls back and does not commit when activity insertion fails', async () => { const client = new FakeClient([result({ project: oldProject }), saved(), { error: new Error('activity failed') }]); setDatabasePoolForTests(pool(client)); await assert.rejects(saveCloudProject(projectId, { userId: ownerId, project, baseRevision: 3 }), /activity failed/); assert.equal(client.calls.filter((call) => call.sql === 'COMMIT').length, 0); assert.equal(client.calls.at(-1).sql, 'ROLLBACK'); assert.equal(client.released, true) })
})

describe('member revocation assignment cleanup', () => {
  it('deletes membership and assignments in one transaction', async () => { const client = new FakeClient([access(), result({ user_id: editorId }), result({}, 0)]); setDatabasePoolForTests(pool(client)); const removed = await removeCloudProjectMember(projectId, editorId, ownerId); assert.equal(removed.userId, editorId); assert.ok(client.calls.some((call) => call.sql.includes('project_assignments'))); assert.equal(client.calls.at(-1).sql, 'COMMIT') })
  it('rolls back cleanup failure and protects owner removal', async () => { const failed = new FakeClient([access(), result({ user_id: editorId }), { error: new Error('cleanup failed') }]); setDatabasePoolForTests(pool(failed)); await assert.rejects(removeCloudProjectMember(projectId, editorId, ownerId), /cleanup failed/); assert.equal(failed.calls.at(-1).sql, 'ROLLBACK'); resetDatabasePoolForTests(); const owner = new FakeClient([access()]); setDatabasePoolForTests(pool(owner)); await assert.rejects(removeCloudProjectMember(projectId, ownerId, ownerId), CloudProjectOwnerImmutableError); assert.equal(owner.calls.at(-1).sql, 'ROLLBACK') })
  it('reports missing members without committing', async () => { const client = new FakeClient([access(), result({}, 0)]); setDatabasePoolForTests(pool(client)); await assert.rejects(removeCloudProjectMember(projectId, editorId, ownerId), CloudProjectMemberNotFoundError); assert.equal(client.calls.at(-1).sql, 'ROLLBACK') })
})
