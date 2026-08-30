import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createProjectTestDatabase, testUsers } from './helpers/project-database.mjs'
import { setDatabasePoolForTests, resetDatabasePoolForTests } from '../database.mjs'
import { createCloudProject, deleteCloudProject, getCloudProject, CloudProjectOwnerRequiredError, CloudProjectNotFoundError } from '../cloud-projects.mjs'
import { revokeDeletedProjectSessions } from '../cloud-project-sessions.mjs'

let database
const project = { format: 'LocalizationHubProject', version: 3, sourceFileName: 'synthetic.json', entries: [{ id: 'e1', source: 'Hello', translation: '' }], workflow: { entries: {} } }
before(async () => { database = await createProjectTestDatabase(); setDatabasePoolForTests(database.pool) })
after(async () => { resetDatabasePoolForTests(); await database?.close() })
async function fixture() {
  const target = await createCloudProject({ ownerUserId: testUsers.owner, name: 'Disposable test', project })
  for (const role of ['editor', 'viewer']) await database.db.query('INSERT INTO project_memberships (project_id,user_id,role) VALUES ($1,$2,$3)', [target.id, testUsers[role], role])
  await database.db.query('INSERT INTO project_assignments (project_id,entry_id,user_id) VALUES ($1,$2,$3)', [target.id, 'e1', testUsers.editor])
  await database.db.query('INSERT INTO project_comments (id,project_id,entry_id,author_user_id,body) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), target.id, 'e1', testUsers.editor, 'Synthetic comment'])
  await database.db.query('INSERT INTO project_activity (project_id,entry_id,actor_user_id,kind) VALUES ($1,$2,$3,$4)', [target.id, 'e1', testUsers.owner, 'test'])
  return target
}

describe('owner deletion against actual project migrations and PostgreSQL constraints', () => {
  it('deletes owner project + all four child tables, preserving unrelated project/users/sessions/Admin/Radio', async () => {
    const target = await fixture()
    const other = await fixture()
    await database.db.query("INSERT INTO admin_audit_log (action,success) VALUES ('test',true)")
    const radio = randomUUID()
    await database.db.query("INSERT INTO radio_tracks (id,title,artist,position) VALUES ($1,'Synthetic','Synthetic',0)", [radio])
    const tables = ['users', 'sessions', 'admin_audit_log', 'radio_tracks']
    const beforeCounts = await Promise.all(tables.map(async (table) => (await database.db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n))
    assert.deepEqual(await deleteCloudProject(target.id, testUsers.owner), { deleted: true, projectId: target.id })
    await assert.rejects(getCloudProject(target.id, testUsers.owner), CloudProjectNotFoundError)
    assert.equal((await getCloudProject(other.id, testUsers.owner)).id, other.id)
    for (const table of ['project_memberships', 'project_assignments', 'project_comments', 'project_activity']) {
      assert.equal((await database.db.query(`SELECT count(*)::int AS n FROM ${table} WHERE project_id = $1`, [target.id])).rows[0].n, 0)
      assert.ok((await database.db.query(`SELECT count(*)::int AS n FROM ${table} WHERE project_id = $1`, [other.id])).rows[0].n > 0)
    }
    assert.deepEqual(await Promise.all(tables.map(async (table) => (await database.db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n)), beforeCounts)
  })
  for (const role of ['editor', 'viewer', 'outsider']) it(`denies ${role} without deleting anything or revealing unrelated projects`, async () => {
    const target = await fixture()
    await assert.rejects(deleteCloudProject(target.id, testUsers[role]), role === 'outsider' ? CloudProjectNotFoundError : CloudProjectOwnerRequiredError)
    assert.equal((await getCloudProject(target.id, testUsers.owner)).id, target.id)
    assert.equal((await database.db.query('SELECT count(*)::int AS n FROM project_comments WHERE project_id=$1', [target.id])).rows[0].n, 1)
  })
  it('handles missing and already-deleted projects safely', async () => {
    await assert.rejects(deleteCloudProject(randomUUID(), testUsers.owner), CloudProjectNotFoundError)
    const target = await fixture()
    await deleteCloudProject(target.id, testUsers.owner)
    await assert.rejects(deleteCloudProject(target.id, testUsers.owner), CloudProjectNotFoundError)
  })
  it('rolls back the entire deletion when a dependent operation fails', async () => {
    const target = await fixture()
    await database.db.exec(`CREATE FUNCTION fail_comment_delete() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER prevent_comment_delete BEFORE DELETE ON project_comments FOR EACH ROW EXECUTE FUNCTION fail_comment_delete();`)
    try {
      await assert.rejects(deleteCloudProject(target.id, testUsers.owner), /synthetic failure/)
      assert.equal((await getCloudProject(target.id, testUsers.owner)).id, target.id)
      assert.equal((await database.db.query('SELECT count(*)::int AS n FROM project_comments WHERE project_id=$1', [target.id])).rows[0].n, 1)
    } finally { await database.db.exec('DROP TRIGGER prevent_comment_delete ON project_comments; DROP FUNCTION fail_comment_delete();') }
  })
  it('revokes only the deleted project live rooms using the existing protocol', () => {
    const socket = {}; const otherSocket = {}
    const rooms = new Map([['one', { cloudProjectId: 'deleted', sockets: new Set([socket]) }], ['two', { cloudProjectId: 'other', sockets: new Set([otherSocket]) }]])
    const cleared = []; const sent = []
    revokeDeletedProjectSessions(rooms, 'deleted', (client) => cleared.push(client), (client, message) => sent.push({ client, message }))
    assert.deepEqual(cleared, [socket]); assert.equal(rooms.size, 1); assert.ok(rooms.get('two').sockets.has(otherSocket))
    assert.equal(sent[0].message.type, 'membership-revoked')
  })
})
