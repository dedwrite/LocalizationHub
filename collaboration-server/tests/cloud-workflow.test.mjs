import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { resetDatabasePoolForTests, setDatabasePoolForTests } from '../database.mjs'
import {
  assignCloudEntry,
  createCloudComment,
  listCloudActivity,
  resolveCloudComment,
  restoreCloudActivity,
} from '../cloud-workflow.mjs'

const projectId = '11111111-1111-4111-8111-111111111111'
const ownerId = '22222222-2222-4222-8222-222222222222'
const editorId = '33333333-3333-4333-8333-333333333333'
const entry = { id: 'entry-1', translation: 'new' }
const project = { entries: [entry], workflow: { entries: { 'entry-1': { status: 'approved' } } } }

class FakeClient {
  constructor(steps) { this.steps = [...steps]; this.calls = []; this.released = false }
  async query(sql, params) { this.calls.push({ sql, params }); if (/^(BEGIN|COMMIT|ROLLBACK|SET TRANSACTION ISOLATION LEVEL REPEATABLE READ)$/u.test(sql)) return { rows: [], rowCount: 0 }; const step = this.steps.shift(); if (!step) throw new Error(`Unexpected query: ${sql}`); if (step.error) throw step.error; if (!Object.hasOwn(step, 'result')) return step; return typeof step.result === 'function' ? step.result(sql, params) : step.result ?? { rows: [], rowCount: 0 } }
  release() { this.released = true }
}
function poolFor(client) { return { connect: async () => client, query: (...args) => client.query(...args) } }
function row(value) { return { rows: [value], rowCount: 1 } }
function empty() { return { rows: [], rowCount: 0 } }
function access(role = 'owner', value = project) { return row({ role, project: value, owner_user_id: ownerId }) }

afterEach(() => resetDatabasePoolForTests())

describe('cloud workflow services with fake database clients', () => {
  it('assigns for owner and commits, releasing the client', async () => { const client = new FakeClient([access(), row({}), empty(), empty()]); setDatabasePoolForTests(poolFor(client)); await assignCloudEntry(projectId, 'entry-1', editorId, ownerId); assert.equal(client.calls[0].sql, 'BEGIN'); assert.equal(client.calls.at(-1).sql, 'COMMIT'); assert.equal(client.released, true) })
  it('allows editor assignment and rejects viewer and outsider', async () => { const editor = new FakeClient([access('editor'), row({}), empty(), empty()]); setDatabasePoolForTests(poolFor(editor)); await assignCloudEntry(projectId, 'entry-1', ownerId, editorId); assert.equal(editor.calls.at(-1).sql, 'COMMIT'); resetDatabasePoolForTests(); for (const accessResult of [access('viewer'), empty()]) { const client = new FakeClient([accessResult, empty()]); setDatabasePoolForTests(poolFor(client)); await assert.rejects(assignCloudEntry(projectId, 'entry-1', ownerId, editorId)); assert.equal(client.calls.at(-1).sql, 'ROLLBACK'); resetDatabasePoolForTests() } })
  it('rejects malformed assignees and unknown entries before mutation', async () => { for (const [assignee, entryId] of [['bad-id', 'entry-1'], [ownerId, 'missing']]) { const client = new FakeClient([access(), empty()]); setDatabasePoolForTests(poolFor(client)); await assert.rejects(assignCloudEntry(projectId, entryId, assignee, ownerId), /invalid-assignee|entry-not-found/); assert.equal(client.calls.at(-1).sql, 'ROLLBACK'); resetDatabasePoolForTests() } })
  it('rolls back assignment activity failures', async () => { const client = new FakeClient([access(), row({}), empty(), { error: new Error('activity failed') }, empty()]); setDatabasePoolForTests(poolFor(client)); await assert.rejects(assignCloudEntry(projectId, 'entry-1', ownerId, ownerId), /activity failed/); assert.equal(client.calls.at(-1).sql, 'ROLLBACK'); assert.equal(client.released, true) })
  it('creates comments atomically and rejects empty/unknown entries', async () => { const client = new FakeClient([access(), row({ id: 'comment-1', created_at: '2026-08-25T00:00:00Z' }), empty()]); setDatabasePoolForTests(poolFor(client)); const comment = await createCloudComment(projectId, 'entry-1', ' note ', ownerId); assert.equal(comment.body, 'note'); assert.equal(client.calls.at(-1).sql, 'COMMIT'); resetDatabasePoolForTests(); const invalid = new FakeClient([access(), empty()]); setDatabasePoolForTests(poolFor(invalid)); await assert.rejects(createCloudComment(projectId, 'missing', 'note', ownerId), /entry-not-found/); resetDatabasePoolForTests(); await assert.rejects(createCloudComment(projectId, 'entry-1', ' ', ownerId), /body/) })
  it('rejects viewer comment creation and rolls back activity failures', async () => { const viewer = new FakeClient([access('viewer'), empty()]); setDatabasePoolForTests(poolFor(viewer)); await assert.rejects(createCloudComment(projectId, 'entry-1', 'note', editorId)); assert.equal(viewer.calls.at(-1).sql, 'ROLLBACK'); resetDatabasePoolForTests(); const failed = new FakeClient([access(), row({ id: 'comment-1', created_at: '2026-08-25T00:00:00Z' }), { error: new Error('activity failed') }, empty()]); setDatabasePoolForTests(poolFor(failed)); await assert.rejects(createCloudComment(projectId, 'entry-1', 'note', ownerId)); assert.equal(failed.calls.at(-1).sql, 'ROLLBACK') })
  it('resolves and unresolves comments with project isolation', async () => { for (const resolved of [true, false]) { const client = new FakeClient([access(), row({ id: 'comment-1', entry_id: 'entry-1' }), empty()]); setDatabasePoolForTests(poolFor(client)); const result = await resolveCloudComment(projectId, 'comment-1', resolved, ownerId); assert.equal(result.resolved, resolved); assert.match(client.calls[2].sql, /CASE WHEN \$2 THEN/) ; resetDatabasePoolForTests() } const isolated = new FakeClient([access(), empty(), empty()]); setDatabasePoolForTests(poolFor(isolated)); await assert.rejects(resolveCloudComment(projectId, 'comment-1', true, ownerId)); resetDatabasePoolForTests() })
  it('rejects viewer comment resolution server-side', async () => { const client = new FakeClient([access('viewer')]); setDatabasePoolForTests(poolFor(client)); await assert.rejects(resolveCloudComment(projectId, 'comment-1', true, editorId)); assert.equal(client.calls.at(-1).sql, 'ROLLBACK') })
  it('reads bounded attributed activity and validates entry filters', async () => { const client = new FakeClient([access(), row({ id: 1, entry_id: 'entry-1', actor_user_id: ownerId, kind: 'translation-changed', payload: {}, created_at: '2026-08-25T00:00:00Z' })]); setDatabasePoolForTests(poolFor(client)); const items = await listCloudActivity(projectId, 'entry-1', ownerId); assert.equal(items[0].actorUserId, ownerId); assert.match(client.calls[1].sql, /LIMIT 100/); resetDatabasePoolForTests(); const invalid = new FakeClient([access()]); setDatabasePoolForTests(poolFor(invalid)); await assert.rejects(listCloudActivity(projectId, 'missing', ownerId), /entry-not-found/) })
  it('restores valid activity, invalidates approval, increments revision, and commits', async () => { const client = new FakeClient([access(), row({ entry_id: 'entry-1', payload: { previousTranslation: 'old' } }), row({ project: structuredClone(project), revision: 4 }), row({ revision: 5 }), empty()]); setDatabasePoolForTests(poolFor(client)); const result = await restoreCloudActivity(projectId, '1', 4, ownerId); assert.equal(result.revision, 5); assert.equal(result.translation, 'old'); assert.equal(client.calls.at(-1).sql, 'COMMIT'); resetDatabasePoolForTests() })
  it('separates missing, malformed, stale, and viewer restore errors', async () => { for (const activity of [empty(), row({ entry_id: 'entry-1', payload: {} })]) { const client = new FakeClient([access(), activity, row({ project: structuredClone(project), revision: 4 }), empty()]); setDatabasePoolForTests(poolFor(client)); await assert.rejects(restoreCloudActivity(projectId, '1', 4, ownerId)); resetDatabasePoolForTests() } const stale = new FakeClient([access(), row({ entry_id: 'entry-1', payload: { previousTranslation: 'old' } }), row({ project: structuredClone(project), revision: 5 }), empty()]); setDatabasePoolForTests(poolFor(stale)); await assert.rejects(restoreCloudActivity(projectId, '1', 4, ownerId), /revision-conflict/); resetDatabasePoolForTests(); const viewer = new FakeClient([access('viewer'), empty()]); setDatabasePoolForTests(poolFor(viewer)); await assert.rejects(restoreCloudActivity(projectId, '1', 4, editorId)); assert.equal(viewer.calls.at(-1).sql, 'ROLLBACK') })
})
