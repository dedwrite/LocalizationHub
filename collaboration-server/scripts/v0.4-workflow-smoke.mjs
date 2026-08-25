import { randomUUID } from 'node:crypto'
import pg from 'pg'

const HTTP_URL = process.env.LH_HTTP_URL?.trim()
const DATABASE_URL = process.env.DATABASE_URL
const EXPECTED_DATABASE = 'localizationhub_v04_e2e'

function refuse(message) { console.error(`[REFUSED] ${message}`); process.exit(2) }
function requireLocalUrl(value, name) { let parsed; try { parsed = new URL(value) } catch { refuse(`${name} must be a valid URL.`) } if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) refuse(`${name} must target localhost or 127.0.0.1.`); return parsed }
if (!HTTP_URL) refuse('LH_HTTP_URL must be supplied explicitly.')
if (!DATABASE_URL?.trim()) refuse('DATABASE_URL must be supplied explicitly.')
const http = requireLocalUrl(HTTP_URL, 'LH_HTTP_URL')
const database = requireLocalUrl(DATABASE_URL, 'DATABASE_URL')
if (database.pathname.slice(1) !== EXPECTED_DATABASE) refuse(`DATABASE_URL must target ${EXPECTED_DATABASE}.`)
if (!['http:', 'https:'].includes(http.protocol)) refuse('LH_HTTP_URL must use HTTP or HTTPS.')
if (!['postgres:', 'postgresql:'].includes(database.protocol)) refuse('DATABASE_URL must use postgres or postgresql.')

const { Pool } = pg
const pool = new Pool({ connectionString: DATABASE_URL, max: 2 })
const createdUsers = []
const createdProjects = []
const tokens = new Map()

function pass(message) { console.log(`[PASS] ${message}`) }
function assert(condition, message) { if (!condition) throw new Error(message) }
function safePath(path) { return path.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/gu, ':id') }
async function diagnosticStep(label, operation) {
  try {
    return await operation()
  } catch (error) {
    console.error(`[FAIL] ${label}`)
    if (error?.method && error?.path && error?.expected !== undefined) {
      console.error(`HTTP ${error.method} ${safePath(error.path)} expected ${error.expected} received ${error.status}`)
    }
    throw error
  }
}
function uniqueIdentity(label) { const suffix = randomUUID().replaceAll('-', '').slice(0, 12); return { username: `v04_${label}_${suffix}`.slice(0, 32), email: `v04_${label}_${suffix}@example.test`, password: `V04-${suffix}-safe-pass` } }
async function request(path, { method = 'GET', token, body, expected = null } = {}) { const response = await fetch(`${HTTP_URL}${path}`, { method, headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null } catch { data = null } if (expected !== null && response.status !== expected) { const error = new Error('HTTP request returned an unexpected status.'); error.method = method; error.path = path; error.expected = expected; error.status = response.status; throw error } if (expected === null && !response.ok) { const error = new Error('HTTP request failed.'); error.method = method; error.path = path; error.expected = '2xx'; error.status = response.status; throw error } return { status: response.status, data } }
async function register(identity) { const result = await request('/api/auth/register', { method: 'POST', body: identity, expected: 201 }); createdUsers.push(identity.username); return result.data }
async function login(identity) { const result = await request('/api/auth/login', { method: 'POST', body: { username: identity.username, password: identity.password }, expected: 200 }); const token = result.data?.token ?? result.data?.sessionToken ?? result.data?.accessToken; assert(typeof token === 'string' && token.length > 0, 'Login response did not contain a session token.'); tokens.set(identity.username, token); return token }
async function verifyUsers() { const client = await pool.connect(); try { await client.query('BEGIN'); await client.query(`UPDATE users SET email_verified_at = NOW() WHERE username = ANY($1::text[])`, [createdUsers]); await client.query('COMMIT') } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() } }
async function db(query, params = []) { return (await pool.query(query, params)).rows }
async function expectRejected(path, options, status) { await request(path, { ...options, expected: status }); }

async function run() {
  const owner = uniqueIdentity('owner'); const editor = uniqueIdentity('editor'); const viewer = uniqueIdentity('viewer'); const outsider = uniqueIdentity('outsider'); const unrelated = uniqueIdentity('unrelated')
  await register(owner); await register(editor); await register(viewer); await register(outsider); await register(unrelated); await verifyUsers()
  const ownerToken = await login(owner); const editorToken = await login(editor); const viewerToken = await login(viewer); const outsiderToken = await login(outsider); pass('Disposable users registered, verified locally, and logged in')
  const projectBody = { name: `v0.4 smoke ${randomUUID().slice(0, 8)}`, project: { format: 'LocalizationHubProject', version: 3, sourceFileName: 'smoke.json', selectedEntryId: 'entry-a', tokenProfile: 'generic', document: { parser: 'json', format: 'flat-json-object', sourceText: '{}' }, entries: [{ id: 'entry-a', key: 'a', source: 'Hello', translation: 'Initial', keyPath: ['a'], sourcePath: ['a'] }, { id: 'entry-b', key: 'b', source: 'World', translation: '', keyPath: ['b'], sourcePath: ['b'] }, { id: 'entry-c', key: 'c', source: 'Menu', translation: 'Menu', keyPath: ['c'], sourcePath: ['c'] }], workflow: { entries: { 'entry-a': { status: 'draft' }, 'entry-c': { status: 'approved' } } } } }
  const created = await request('/api/projects', { method: 'POST', token: ownerToken, body: projectBody, expected: 201 }); const snapshot = created.data.project; const projectId = snapshot.id; let revision = snapshot.revision; createdProjects.push(projectId); pass('V3 project created')
  await request(`/api/projects/${projectId}`, { token: ownerToken }); await request(`/api/projects/${projectId}/members`, { method: 'POST', token: ownerToken, body: { username: editor.username, role: 'editor' }, expected: 201 }); await request(`/api/projects/${projectId}/members`, { method: 'POST', token: ownerToken, body: { username: viewer.username, role: 'viewer' }, expected: 201 }); pass('Owner read and membership management')
  await request(`/api/projects/${projectId}`, { token: editorToken }); await request(`/api/projects/${projectId}`, { token: viewerToken });
  const editorProject = structuredClone(projectBody.project); editorProject.entries[1].translation = 'Editor save'; const editorSave = await request(`/api/projects/${projectId}`, { method: 'PUT', token: editorToken, body: { baseRevision: revision, project: editorProject }, expected: 200 }); revision = editorSave.data.project.revision;
  await expectRejected(`/api/projects/${projectId}`, { method: 'PUT', token: viewerToken, body: { baseRevision: revision, project: projectBody.project } }, 403); await expectRejected(`/api/projects/${projectId}`, { token: outsiderToken }, 404); pass('Owner/editor/viewer access and outsider isolation')
  const editorRow = (await db('SELECT id FROM users WHERE username = $1', [editor.username]))[0]; const viewerRow = (await db('SELECT id FROM users WHERE username = $1', [viewer.username]))[0]; const unrelatedRow = (await db('SELECT id FROM users WHERE username = $1', [unrelated.username]))[0]
  await request(`/api/projects/${projectId}/assignments/entry-a`, { method: 'PUT', token: ownerToken, body: { assigneeUserId: editorRow.id }, expected: 200 }); assert((await db('SELECT 1 FROM project_assignments WHERE project_id = $1 AND entry_id = $2 AND user_id = $3', [projectId, 'entry-a', editorRow.id])).length === 1, 'Assignment was not persisted'); pass('Assignment persisted')
  await request(`/api/projects/${projectId}/assignments/entry-a`, { method: 'PUT', token: editorToken, body: { assigneeUserId: viewerRow.id }, expected: 200 }); await expectRejected(`/api/projects/${projectId}/assignments/entry-a`, { method: 'PUT', token: viewerToken, body: { assigneeUserId: editorRow.id } }, 403); await expectRejected(`/api/projects/${projectId}/assignments/entry-a`, { method: 'PUT', token: ownerToken, body: { assigneeUserId: unrelatedRow.id } }, 400); await expectRejected(`/api/projects/${projectId}/assignments/unknown`, { method: 'PUT', token: ownerToken, body: { assigneeUserId: editorRow.id } }, 404); await expectRejected(`/api/projects/${projectId}/assignments/entry-a`, { method: 'PUT', token: outsiderToken, body: { assigneeUserId: editorRow.id } }, 404); pass('Assignment permissions and validation')
  const comment = await diagnosticStep('Comments: editor create', () => request(`/api/projects/${projectId}/entries/entry-a/comments`, {
    method: 'POST', token: editorToken, body: { body: 'Smoke comment' }, expected: 201,
  }))
  const commentId = comment.data.comment.id
  await diagnosticStep('Comments: read persisted', async () => assert((await db('SELECT id FROM project_comments WHERE id = $1', [commentId])).length === 1, 'Comment was not persisted'))
  await diagnosticStep('Comments: viewer read', () => request(`/api/projects/${projectId}/entries/entry-a/comments`, { token: viewerToken }))
  await diagnosticStep('Comments: viewer mutation rejected', () => expectRejected(`/api/projects/${projectId}/entries/entry-a/comments`, { method: 'POST', token: viewerToken, body: { body: 'Nope' } }, 403))
  await diagnosticStep('Comments: owner resolve', () => request(`/api/projects/${projectId}/comments/${commentId}`, { method: 'PATCH', token: ownerToken, body: { resolved: true }, expected: 200 }))
  const resolvedComments = await diagnosticStep('Comments: resolve state persisted', () => request(`/api/projects/${projectId}/entries/entry-a/comments`, { token: viewerToken }))
  await diagnosticStep('Comments: resolve state assertion', async () => assert(resolvedComments.data.comments.some((item) => item.id === commentId && item.resolved === true), 'Comment did not resolve'))
  await diagnosticStep('Comments: owner unresolve', () => request(`/api/projects/${projectId}/comments/${commentId}`, { method: 'PATCH', token: ownerToken, body: { resolved: false }, expected: 200 }))
  await diagnosticStep('Comments: unknown entry rejected', () => expectRejected(`/api/projects/${projectId}/entries/missing/comments`, { method: 'POST', token: ownerToken, body: { body: 'Nope' } }, 404))
  pass('Comments, resolution, Viewer read-only, and entry validation')
  const beforeSave = await diagnosticStep('Activity: prepare save', () => request(`/api/projects/${projectId}`, { token: ownerToken })); const changed = structuredClone(beforeSave.data.project.project); changed.entries[0].translation = 'Changed'; changed.workflow.entries['entry-a'].status = 'needs-review'; const saved = await diagnosticStep('Activity: save translation and workflow', () => request(`/api/projects/${projectId}`, { method: 'PUT', token: ownerToken, body: { baseRevision: beforeSave.data.project.revision, project: changed }, expected: 200 })); revision = saved.data.project.revision; const activity = await diagnosticStep('Activity: fetch', () => request(`/api/projects/${projectId}/activity`, { token: viewerToken })); const kinds = activity.data.activity.map((item) => item.kind); for (const kind of ['translation-changed', 'workflow-changed', 'assignment-changed', 'comment-created', 'comment-resolved']) await diagnosticStep(`Activity: ${kind}`, async () => assert(kinds.includes(kind), `Missing activity kind ${kind}`)); await diagnosticStep('Activity: attribution', async () => assert(activity.data.activity.every((item) => 'id' in item && 'actorUserId' in item && 'kind' in item && 'payload' in item && 'createdAt' in item), 'Activity attribution incomplete')); pass('Translation/workflow/assignment/comment activity')
  const translationActivity = activity.data.activity.find((item) => item.kind === 'translation-changed'); const restored = await diagnosticStep('Restore: perform', () => request(`/api/projects/${projectId}/activity/${translationActivity.id}/restore`, { method: 'POST', token: ownerToken, body: { baseRevision: revision }, expected: 200 })); await diagnosticStep('Restore: revision increment', async () => assert(restored.data.restore.revision === revision + 1, 'Restore did not increment revision')); await diagnosticStep('Restore: previous translation', async () => assert(restored.data.restore.translation === 'Initial', 'Restore did not restore previous translation')); revision = restored.data.restore.revision; const afterRestore = await diagnosticStep('Restore: restored activity', () => request(`/api/projects/${projectId}/activity`, { token: ownerToken })); await diagnosticStep('Restore: restored activity assertion', async () => assert(afterRestore.data.activity.some((item) => item.kind === 'translation-restored'), 'Restore activity missing')); await diagnosticStep('Restore: stale revision', () => expectRejected(`/api/projects/${projectId}/activity/${translationActivity.id}/restore`, { method: 'POST', token: ownerToken, body: { baseRevision: revision - 1 } }, 409)); await diagnosticStep('Restore: viewer rejection', () => expectRejected(`/api/projects/${projectId}/activity/${translationActivity.id}/restore`, { method: 'POST', token: viewerToken, body: { baseRevision: revision } }, 403)); pass('Restore, revision conflict, and Viewer rejection')
  const second = await diagnosticStep('Project isolation: create second project', () => request('/api/projects', { method: 'POST', token: ownerToken, body: projectBody, expected: 201 })); const secondId = second.data.project.id; createdProjects.push(secondId); await diagnosticStep('Project isolation: cross-project mutation rejected', () => expectRejected(`/api/projects/${secondId}/comments/${commentId}`, { method: 'PATCH', token: ownerToken, body: { resolved: true } }, 404)); pass('Project isolation')
  await diagnosticStep('Member revocation: assign editor', () => request(`/api/projects/${projectId}/assignments/entry-a`, { method: 'PUT', token: ownerToken, body: { assigneeUserId: editorRow.id }, expected: 200 })); await diagnosticStep('Member revocation: remove editor', () => request(`/api/projects/${projectId}/members/${editorRow.id}`, { method: 'DELETE', token: ownerToken, expected: 200 })); await diagnosticStep('Member revocation: assignment cleanup', async () => assert((await db('SELECT 1 FROM project_assignments WHERE project_id = $1 AND user_id = $2', [projectId, editorRow.id])).length === 0, 'Revoked member assignment remains')); await diagnosticStep('Member revocation: access rejected', () => expectRejected(`/api/projects/${projectId}`, { token: editorToken }, 404)); pass('Member revocation assignment cleanup')
}

let runSucceeded = false
let cleanupSucceeded = false

try {
  await run()
  runSucceeded = true
} catch {
  console.error('[FAIL] v0.4 workflow E2E assertions failed.')
} finally {
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      if (createdProjects.length) {
        await client.query(
          'DELETE FROM projects WHERE id = ANY($1::uuid[])',
          [createdProjects],
        )
      }
      if (createdUsers.length) {
        await client.query(
          'DELETE FROM users WHERE username = ANY($1::text[])',
          [createdUsers],
        )
      }
      await client.query('COMMIT')
      cleanupSucceeded = true
    } catch {
      await client.query('ROLLBACK').catch(() => undefined)
      console.error('[FAIL] v0.4 workflow E2E cleanup failed.')
    } finally {
      client.release()
    }
  } catch {
    console.error('[FAIL] v0.4 workflow E2E cleanup failed.')
  }
  await pool.end().catch(() => undefined)
}

if (runSucceeded && cleanupSucceeded) {
  console.log('v0.4 workflow E2E smoke: PASS')
} else {
  process.exitCode = 1
}
