import { getDatabasePool } from './database.mjs'

/*
 * Self-service account deletion.
 *
 * The Admin console deletes accounts too, and both paths must mean exactly the
 * same thing: `removeUserRecords` is the single owner of the cascade, and the
 * two callers only differ in the transaction they open and the audit action
 * they record.
 */

export class AccountDeletionError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AccountDeletionError'
    this.code = code
  }
}

/**
 * Removes every record tied to one account inside the caller's transaction.
 * The caller owns BEGIN/COMMIT and chooses the error class to raise, so the
 * Admin path keeps `AdminSecurityError` and the user path raises
 * `AccountDeletionError` for the same two refusals.
 */
export async function removeUserRecords(client, userId, deleteOwnedProjects, createError) {
  /* Rows are counted, not `rowCount`: a SELECT reports zero affected rows on
   * every driver, and only the returned rows say whether the account exists. */
  const userResult = await client.query('SELECT id, email FROM users WHERE id = $1', [userId])
  if (!userResult.rows.length) throw createError('user-not-found', 'User not found.')
  const ownedProjects = await client.query('SELECT id FROM projects WHERE owner_user_id = $1', [userId])
  if (ownedProjects.rows.length && !deleteOwnedProjects) throw createError('user-has-projects', 'User owns projects. Set deleteOwnedProjects=true.')
  const projectIds = ownedProjects.rows.map((project) => project.id)

  if (deleteOwnedProjects) {
    for (const projectId of projectIds) await client.query('DELETE FROM project_assignments WHERE project_id = $1', [projectId])
    for (const projectId of projectIds) await client.query('DELETE FROM project_comments WHERE project_id = $1', [projectId])
    for (const projectId of projectIds) await client.query('DELETE FROM project_activity WHERE project_id = $1', [projectId])
    for (const projectId of projectIds) await client.query('DELETE FROM project_memberships WHERE project_id = $1', [projectId])
    await client.query('DELETE FROM projects WHERE owner_user_id = $1', [userId])
  } else {
    const memberships = await client.query('SELECT project_id FROM project_memberships WHERE user_id = $1', [userId])
    for (const membership of memberships.rows) await client.query('DELETE FROM project_assignments WHERE project_id = $1 AND user_id = $2', [membership.project_id, userId])
    await client.query('DELETE FROM project_memberships WHERE user_id = $1', [userId])
  }

  await client.query('DELETE FROM admin_totp_enrollments WHERE user_id = $1', [userId])
  await client.query('DELETE FROM admin_email_challenges WHERE user_id = $1', [userId])
  await client.query('DELETE FROM admin_sessions WHERE user_id = $1', [userId])
  await client.query('DELETE FROM sessions WHERE user_id = $1', [userId])
  await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId])
  await client.query('DELETE FROM users WHERE id = $1', [userId])

  return { projectIds, deletedProjects: deleteOwnedProjects ? projectIds.length : 0 }
}

/**
 * Deletes the caller's own account. The event is recorded in the platform audit
 * log with no admin actor, so an operator can still see that it happened.
 */
export async function deleteOwnAccount(userId, { deleteOwnedProjects = false } = {}) {
  const database = getDatabasePool()
  const client = await database.connect()
  try {
    await client.query('BEGIN')
    const result = await removeUserRecords(client, userId, deleteOwnedProjects, (code, message) => new AccountDeletionError(code, message))
    await client.query(
      "INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, success, metadata) VALUES (NULL, 'account.self_delete', 'user', $1, true, $2::jsonb)",
      [userId, JSON.stringify({ deleted_projects: result.deletedProjects })],
    )
    await client.query('COMMIT')
    return { deleted: true, projects: result.deletedProjects, projectIds: result.projectIds }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Deleting an account also ends the live sessions it opened, including the
 * socket that asked for the deletion. Other members of a room keep theirs.
 */
export function revokeDeletedAccountSessions(sessions, userId, getUserId, clearClient, sendError) {
  for (const session of [...sessions.values()]) {
    for (const socket of [...session.sockets]) {
      if (getUserId(socket) !== userId) continue
      clearClient(socket)
      sendError(socket, 'account-deleted', 'This account was deleted.')
      session.sockets.delete(socket)
    }
    if (session.sockets.size === 0) sessions.delete(session.sessionId)
  }
}
