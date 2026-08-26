import { randomUUID } from 'node:crypto'

import { getDatabasePool } from './database.mjs'
import {
  CloudProjectNotFoundError,
  CloudProjectPermissionError,
  canEditCloudProject,
} from './cloud-projects.mjs'

async function getProjectAccess(database, projectId, userId) {
  const result = await database.query(
    `SELECT projects.owner_user_id,
            projects.project,
            CASE WHEN projects.owner_user_id = $2
              THEN 'owner' ELSE memberships.role END AS role
       FROM projects
       LEFT JOIN project_memberships memberships
         ON memberships.project_id = projects.id
        AND memberships.user_id = $2
      WHERE projects.id = $1
        AND (projects.owner_user_id = $2 OR memberships.user_id IS NOT NULL)
      LIMIT 1`,
    [projectId, userId],
  )
  if (!result.rows[0]) throw new CloudProjectNotFoundError()
  return result.rows[0]
}

function requireWrite(role) {
  if (!canEditCloudProject(role)) throw new CloudProjectPermissionError()
}

function requireUserId(value) {
  if (typeof value !== 'string' || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
    throw new Error('invalid-assignee')
  }
}

function requireEntry(project, entryId) {
  if (!Array.isArray(project.entries) || !project.entries.some((entry) => entry.id === entryId)) {
    throw new Error('entry-not-found')
  }
}

function activityValue(row) {
  return {
    id: String(row.id),
    entryId: row.entry_id,
    actorUserId: row.actor_user_id,
    kind: row.kind,
    payload: row.payload,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function assignCloudEntry(projectId, entryId, assigneeUserId, actorUserId) {
  const database = getDatabasePool()
  const client = await database.connect()
  try {
    await client.query('BEGIN')
    const access = await getProjectAccess(client, projectId, actorUserId)
    requireWrite(access.role)
    requireEntry(access.project, entryId)
    if (assigneeUserId === null) {
      await client.query(
        'DELETE FROM project_assignments WHERE project_id = $1 AND entry_id = $2',
        [projectId, entryId],
      )
    } else {
      requireUserId(assigneeUserId)
      const member = await client.query(
        `SELECT 1 FROM projects
          WHERE id = $1 AND owner_user_id = $2
         UNION ALL
        SELECT 1 FROM project_memberships
          WHERE project_id = $1 AND user_id = $2`,
        [projectId, assigneeUserId],
      )
      if (!member.rowCount) throw new Error('invalid-assignee')
      await client.query(
        `INSERT INTO project_assignments (project_id, entry_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, entry_id)
         DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()`,
        [projectId, entryId, assigneeUserId],
      )
    }
    await client.query(
      `INSERT INTO project_activity (project_id, entry_id, actor_user_id, kind, payload)
       VALUES ($1, $2, $3, 'assignment-changed', $4::jsonb)`,
      [projectId, entryId, actorUserId, JSON.stringify({ assigneeUserId })],
    )
    await client.query('COMMIT')
    return { entryId, assigneeUserId }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listCloudAssignments(projectId, actorUserId) {
  const database = getDatabasePool()
  const access = await getProjectAccess(database, projectId, actorUserId)
  const result = await database.query(
    `SELECT entry_id, user_id, updated_at
       FROM project_assignments
      WHERE project_id = $1
      ORDER BY entry_id`,
    [projectId],
  )
  return {
    assignments: result.rows.map((row) => ({
      entryId: row.entry_id,
      assigneeUserId: row.user_id,
      updatedAt: new Date(row.updated_at).toISOString(),
    })),
    role: access.role,
  }
}

export async function listCloudComments(projectId, entryId, actorUserId) {
  const database = getDatabasePool()
  const access = await getProjectAccess(database, projectId, actorUserId)
  requireEntry(access.project, entryId)
  const result = await database.query(
    `SELECT comments.*, users.username
       FROM project_comments comments
       LEFT JOIN users ON users.id = comments.author_user_id
      WHERE comments.project_id = $1 AND comments.entry_id = $2
      ORDER BY comments.created_at DESC, comments.id DESC
      LIMIT 100`,
    [projectId, entryId],
  )
  return result.rows.map((row) => ({
    id: row.id,
    entryId: row.entry_id,
    body: row.body,
    authorUserId: row.author_user_id,
    authorName: row.username,
    createdAt: new Date(row.created_at).toISOString(),
    resolved: Boolean(row.resolved_at),
  }))
}

export async function listCloudCommentCounts(projectId, actorUserId) {
  const database = getDatabasePool()
  const access = await getProjectAccess(database, projectId, actorUserId)
  const result = await database.query(
    `SELECT entry_id, COUNT(*)::int AS comment_count,
            COUNT(*) FILTER (WHERE resolved_at IS NULL)::int AS unresolved_count
       FROM project_comments
      WHERE project_id = $1
      GROUP BY entry_id
      ORDER BY entry_id`,
    [projectId],
  )
  return {
    entries: result.rows.map((row) => ({
      entryId: row.entry_id,
      count: row.comment_count,
      unresolved: row.unresolved_count,
    })),
    role: access.role,
  }
}

export async function createCloudComment(projectId, entryId, body, actorUserId) {
  if (typeof body !== 'string' || !body.trim()) throw new Error('invalid-body')
  const database = getDatabasePool()
  const client = await database.connect()
  try {
    await client.query('BEGIN')
    const access = await getProjectAccess(client, projectId, actorUserId)
    requireWrite(access.role)
    requireEntry(access.project, entryId)
    const comment = await client.query(
      `INSERT INTO project_comments (id, project_id, entry_id, author_user_id, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [randomUUID(), projectId, entryId, actorUserId, body.trim()],
    )
    await client.query(
      `INSERT INTO project_activity (project_id, entry_id, actor_user_id, kind, payload)
       VALUES ($1, $2, $3, 'comment-created', $4::jsonb)`,
      [projectId, entryId, actorUserId, JSON.stringify({ commentId: comment.rows[0].id })],
    )
    await client.query('COMMIT')
    return {
      id: comment.rows[0].id,
      entryId,
      body: body.trim(),
      authorUserId: actorUserId,
      createdAt: new Date(comment.rows[0].created_at).toISOString(),
      resolved: false,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function resolveCloudComment(projectId, commentId, resolved, actorUserId) {
  const database = getDatabasePool()
  const client = await database.connect()
  try {
    await client.query('BEGIN')
    const access = await getProjectAccess(client, projectId, actorUserId)
    requireWrite(access.role)
    const result = await client.query(
      `UPDATE project_comments
          SET resolved_at = CASE WHEN $2 THEN COALESCE(resolved_at, NOW()) ELSE NULL END,
              resolved_by_user_id = CASE WHEN $2 THEN $3::uuid ELSE NULL::uuid END
        WHERE id = $1 AND project_id = $4
        RETURNING id, entry_id`,
      [commentId, resolved, actorUserId, projectId],
    )
    if (!result.rowCount) throw new CloudProjectNotFoundError()
    await client.query(
      `INSERT INTO project_activity (project_id, entry_id, actor_user_id, kind, payload)
       VALUES ($1, $2, $3, 'comment-resolved', $4::jsonb)`,
      [projectId, result.rows[0].entry_id, actorUserId, JSON.stringify({ commentId, resolved })],
    )
    await client.query('COMMIT')
    return { id: commentId, resolved }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listCloudActivity(projectId, entryId, actorUserId) {
  const database = getDatabasePool()
  const access = await getProjectAccess(database, projectId, actorUserId)
  if (entryId) requireEntry(access.project, entryId)
  const result = await database.query(
    `SELECT id, entry_id, actor_user_id, kind, payload, created_at
       FROM project_activity
      WHERE project_id = $1 AND ($2::text IS NULL OR entry_id = $2)
      ORDER BY created_at DESC, id DESC
      LIMIT 100`,
    [projectId, entryId ?? null],
  )
  return result.rows.map(activityValue)
}

export async function restoreCloudActivity(projectId, activityId, baseRevision, actorUserId) {
  const database = getDatabasePool()
  const client = await database.connect()
  try {
    await client.query('BEGIN')
    const access = await getProjectAccess(client, projectId, actorUserId)
    requireWrite(access.role)
    const activity = await client.query(
      `SELECT entry_id, payload
         FROM project_activity
        WHERE id = $1 AND project_id = $2 AND kind = 'translation-changed'`,
      [activityId, projectId],
    )
    const projectResult = await client.query(
      'SELECT project, revision FROM projects WHERE id = $1 FOR UPDATE',
      [projectId],
    )
    const payload = activity.rows[0]?.payload
    if (!activity.rowCount) throw new Error('invalid-activity')
    if (!projectResult.rowCount) throw new CloudProjectNotFoundError()
    if (projectResult.rows[0].revision !== baseRevision) {
      throw new Error('revision-conflict')
    }
    if (typeof payload.previousTranslation !== 'string') throw new Error('invalid-activity')
    const project = projectResult.rows[0].project
    requireEntry(project, activity.rows[0].entry_id)
    const entry = project.entries.find((item) => item.id === activity.rows[0].entry_id)
    const previousTranslation = entry.translation
    entry.translation = payload.previousTranslation
    const workflow = project.workflow?.entries?.[entry.id]
    const previousStatus = workflow?.status ?? null
    if (workflow?.status === 'approved' || workflow?.status === 'needs-review') delete project.workflow.entries[entry.id]
    const nextStatus = project.workflow?.entries?.[entry.id]?.status ?? null
    const updated = await client.query(
      `UPDATE projects SET project = $2::jsonb, revision = revision + 1, updated_at = NOW()
        WHERE id = $1 AND revision = $3 RETURNING revision`,
      [projectId, JSON.stringify(project), baseRevision],
    )
    if (!updated.rowCount) throw new Error('revision-conflict')
    await client.query(
      `INSERT INTO project_activity (project_id, entry_id, actor_user_id, kind, payload)
       VALUES ($1, $2, $3, 'translation-restored', $4::jsonb)`,
      [projectId, entry.id, actorUserId, JSON.stringify({ previousTranslation, newTranslation: entry.translation, restoredActivityId: activityId, previousStatus, newStatus: nextStatus })],
    )
    await client.query('COMMIT')
    return { revision: updated.rows[0].revision, translation: entry.translation }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
