import {
  randomUUID,
} from 'node:crypto'

import {
  getDatabasePool,
} from './database.mjs'

export class CloudProjectConflictError
  extends Error {
  constructor(
    currentRevision,
  ) {
    super(
      'Cloud project revision conflict.',
    )

    this.name =
      'CloudProjectConflictError'

    this.currentRevision =
      currentRevision
  }
}

export class CloudProjectNotFoundError
  extends Error {
  constructor() {
    super(
      'Cloud project was not found.',
    )

    this.name =
      'CloudProjectNotFoundError'
  }
}

export class CloudProjectPermissionError
  extends Error {
  constructor() {
    super(
      'Cloud project is read-only for this user.',
    )

    this.name =
      'CloudProjectPermissionError'
  }
}

export class CloudProjectOwnerRequiredError
  extends Error {
  constructor() {
    super(
      'Cloud Project owner access is required.',
    )

    this.name =
      'CloudProjectOwnerRequiredError'
  }
}

export class CloudProjectOwnerImmutableError
  extends Error {
  constructor() {
    super(
      'Cloud Project owner membership cannot be modified.',
    )

    this.name =
      'CloudProjectOwnerImmutableError'
  }
}

export class CloudProjectMemberValidationError
  extends Error {
  constructor(
    message =
      'Cloud Project membership request is invalid.',
  ) {
    super(
      message,
    )

    this.name =
      'CloudProjectMemberValidationError'
  }
}

export class CloudProjectMemberNotFoundError
  extends Error {
  constructor() {
    super(
      'Cloud Project member was not found.',
    )

    this.name =
      'CloudProjectMemberNotFoundError'
  }
}

export class CloudProjectMemberAlreadyExistsError
  extends Error {
  constructor() {
    super(
      'User is already part of this Cloud Project.',
    )

    this.name =
      'CloudProjectMemberAlreadyExistsError'
  }
}

export class CloudProjectMemberUserNotFoundError
  extends Error {
  constructor() {
    super(
      'Cloud Project member user was not found.',
    )

    this.name =
      'CloudProjectMemberUserNotFoundError'
  }
}

function requireUserId(
  userId,
) {
  if (
    typeof userId !==
      'string' ||
    userId.length === 0
  ) {
    throw new TypeError(
      'Cloud Project user ID is required.',
    )
  }

  return userId
}

function requireMemberRole(
  role,
) {
  if (
    role !==
      'editor' &&
    role !==
      'viewer'
  ) {
    throw new CloudProjectMemberValidationError(
      'Cloud Project member role must be editor or viewer.',
    )
  }

  return role
}

function requireMemberUsername(
  username,
) {
  if (
    typeof username !==
      'string'
  ) {
    throw new CloudProjectMemberValidationError(
      'Cloud Project member username is required.',
    )
  }

  const normalized =
    username
      .trim()
      .toLowerCase()

  if (
    normalized.length <
      3 ||
    normalized.length >
      32 ||
    !/^[a-z0-9._-]+$/.test(
      normalized,
    )
  ) {
    throw new CloudProjectMemberValidationError(
      'Cloud Project member username is invalid.',
    )
  }

  return normalized
}

async function getProjectAccess(
  database,
  projectId,
  userId,
) {
  requireUserId(
    userId,
  )

  const result =
    await database.query(
      `SELECT
         projects.owner_user_id,
         CASE
           WHEN projects.owner_user_id = $2
             THEN 'owner'
           ELSE memberships.role
         END AS role
       FROM projects
       LEFT JOIN project_memberships
         AS memberships
         ON memberships.project_id =
              projects.id
        AND memberships.user_id = $2
       WHERE
         projects.id = $1
         AND (
           projects.owner_user_id = $2
           OR memberships.user_id IS NOT NULL
         )
       LIMIT 1`,
      [
        projectId,
        userId,
      ],
    )

  const row =
    result.rows[0]

  if (!row) {
    throw new CloudProjectNotFoundError()
  }

  return {
    ownerUserId:
      row.owner_user_id,

    role:
      row.role,
  }
}

/*
 * Returns the caller's effective role for a
 * Cloud Project without throwing when the
 * user is not a member.
 *
 * Used by the WebSocket layer to authorize
 * live collaboration edits and to decide
 * whether a participant may still write.
 */
export async function getCloudProjectRoleForUser(
  projectId,
  userId,
) {
  requireUserId(
    userId,
  )

  const database =
    getDatabasePool()

  const result =
    await database.query(
      `SELECT
         projects.owner_user_id,
         CASE
           WHEN projects.owner_user_id = $2
             THEN 'owner'
           ELSE memberships.role
         END AS role
       FROM projects
       LEFT JOIN project_memberships
         AS memberships
         ON memberships.project_id =
              projects.id
        AND memberships.user_id = $2
       WHERE
         projects.id = $1
       LIMIT 1`,
      [
        projectId,
        userId,
      ],
    )

  const row =
    result.rows[0]

  if (!row) {
    return null
  }

  if (
    row.owner_user_id ===
      userId
  ) {
    return 'owner'
  }

  return (
    row.role ??
    null
  )
}

export function canEditCloudProject(
  role,
) {
  return (
    role ===
      'owner' ||
    role ===
      'editor'
  )
}

async function requireProjectAccess(
  database,
  projectId,
  userId,
) {
  const access =
    await getProjectAccess(
      database,
      projectId,
      userId,
    )

  return access.role
}

async function requireProjectOwner(
  database,
  projectId,
  userId,
) {
  const access =
    await getProjectAccess(
      database,
      projectId,
      userId,
    )

  if (
    access.role !==
      'owner'
  ) {
    throw new CloudProjectOwnerRequiredError()
  }

  return access.ownerUserId
}

function toSnapshot(
  row,
) {
  return {
    id:
      row.id,

    name:
      row.name,

    role:
      row.role,

    revision:
      row.revision,

    updatedAt:
      new Date(
        row.updated_at,
      ).toISOString(),

    project:
      row.project,
  }
}

export async function createCloudProject({
  ownerUserId,
  name,
  project,
}) {
  requireUserId(
    ownerUserId,
  )

  const database =
    getDatabasePool()

  const result =
    await database.query(
      `INSERT INTO projects (
         id,
         owner_user_id,
         name,
         revision,
         project
       )
       VALUES (
         $1,
         $2,
         $3,
         1,
         $4::jsonb
       )
       RETURNING
         id,
         name,
         revision,
         updated_at,
         project,
         'owner'::text AS role`,
      [
        randomUUID(),
        ownerUserId,
        name,
        JSON.stringify(
          project,
        ),
      ],
    )

  return toSnapshot(
    result.rows[0],
  )
}

export async function listCloudProjects(
  userId,
) {
  requireUserId(
    userId,
  )

  const database =
    getDatabasePool()

  const result =
    await database.query(
      `SELECT
         projects.id,
         projects.name,
         projects.project ->> 'sourceFileName'
           AS source_file_name,
         projects.revision,
         projects.updated_at,
         jsonb_array_length(
           COALESCE(projects.project -> 'entries', '[]'::jsonb)
         ) AS entry_count,
         (
           SELECT COUNT(*)
           FROM jsonb_array_elements(
             COALESCE(projects.project -> 'entries', '[]'::jsonb)
           ) AS entry
           WHERE length(COALESCE(entry ->> 'translation', '')) > 0
         ) AS translated_count,
         (
           SELECT COUNT(*)::int
           FROM project_memberships AS members
           WHERE members.project_id = projects.id
         ) AS member_count,
         CASE
           WHEN projects.owner_user_id = $1
             THEN 'owner'
           ELSE memberships.role
         END AS role
       FROM projects
       LEFT JOIN project_memberships
         AS memberships
         ON memberships.project_id =
              projects.id
        AND memberships.user_id = $1
       WHERE
         projects.owner_user_id = $1
         OR memberships.user_id IS NOT NULL
       ORDER BY
         projects.updated_at DESC`,
      [
        userId,
      ],
    )

  return result.rows.map(
    (
      row,
    ) => ({
      id:
        row.id,

      name:
        row.name,

      sourceFileName:
        row.source_file_name,

      role:
        row.role,

      revision:
        row.revision,

      updatedAt:
        new Date(
          row.updated_at,
        ).toISOString(),

      entryCount:
        row.entry_count,

      translatedCount:
        row.translated_count,

      memberCount:
        row.member_count,
    }),
  )
}

export async function getCloudProject(
  projectId,
  userId,
) {
  requireUserId(
    userId,
  )

  const database =
    getDatabasePool()

  const result =
    await database.query(
      `SELECT
         projects.id,
         projects.name,
         projects.revision,
         projects.updated_at,
         projects.project,
         CASE
           WHEN projects.owner_user_id = $2
             THEN 'owner'
           ELSE memberships.role
         END AS role
       FROM projects
       LEFT JOIN project_memberships
         AS memberships
         ON memberships.project_id =
              projects.id
        AND memberships.user_id = $2
       WHERE
         projects.id = $1
         AND (
           projects.owner_user_id = $2
           OR memberships.user_id IS NOT NULL
         )
       LIMIT 1`,
      [
        projectId,
        userId,
      ],
    )

  const row =
    result.rows[0]

  if (!row) {
    throw new CloudProjectNotFoundError()
  }

  return toSnapshot(
    row,
  )
}

export async function saveCloudProject(
  projectId,
  {
    userId,
    project,
    baseRevision,
  },
) {
  requireUserId(
    userId,
  )

  const database = getDatabasePool()
  const client = await database.connect()

  try {
    await client.query('BEGIN')

    const previousResult = await client.query(
      `SELECT project
       FROM projects
       WHERE id = $1
         AND revision = $2
         AND (
           owner_user_id = $3
           OR EXISTS (
             SELECT 1 FROM project_memberships
              WHERE project_memberships.project_id = projects.id
                AND project_memberships.user_id = $3
                AND project_memberships.role = 'editor'
           )
         )
       FOR UPDATE`,
      [projectId, baseRevision, userId],
    )
    const previousProject = previousResult.rows[0]?.project

    const result =
      await client.query(
      `UPDATE projects
       SET
         project = $3::jsonb,
         revision = revision + 1,
         updated_at = NOW()
       WHERE
         id = $1
         AND revision = $4
         AND (
           owner_user_id = $2
           OR EXISTS (
             SELECT 1
             FROM project_memberships
             WHERE
               project_memberships.project_id =
                 projects.id
               AND project_memberships.user_id = $2
               AND project_memberships.role =
                 'editor'
           )
         )
       RETURNING
         id,
         name,
         revision,
         updated_at,
         project,
         CASE
           WHEN owner_user_id = $2
             THEN 'owner'
           ELSE 'editor'
         END AS role`,
        [projectId, userId, JSON.stringify(project), baseRevision],
      )

    if (result.rowCount === 1) {
      if (previousProject) {
      const previousById = new Map(previousProject.entries.map((entry) => [entry.id, entry]))
      for (const entry of project.entries) {
        const previous = previousById.get(entry.id)
        if (previous && previous.translation !== entry.translation) {
          await client.query(
            `INSERT INTO project_activity (project_id, entry_id, actor_user_id, kind, payload) VALUES ($1, $2, $3, 'translation-changed', $4::jsonb)`,
            [projectId, entry.id, userId, JSON.stringify({ previousTranslation: previous.translation, newTranslation: entry.translation })],
          )
        }
        const previousStatus = previousProject.workflow?.entries?.[entry.id]?.status ?? null
        const nextStatus = project.workflow?.entries?.[entry.id]?.status ?? null
        if (previousStatus !== nextStatus) {
          await client.query(
            `INSERT INTO project_activity (project_id, entry_id, actor_user_id, kind, payload) VALUES ($1, $2, $3, 'workflow-changed', $4::jsonb)`,
            [projectId, entry.id, userId, JSON.stringify({ previousStatus, newStatus: nextStatus })],
          )
        }
      }
      }
      await client.query('COMMIT')
      return toSnapshot(result.rows[0])
    }

    const current =
      await client.query(
      `SELECT
         projects.revision,
         CASE
           WHEN projects.owner_user_id = $2
             THEN 'owner'
           ELSE memberships.role
         END AS role
       FROM projects
       LEFT JOIN project_memberships
         AS memberships
         ON memberships.project_id =
              projects.id
        AND memberships.user_id = $2
       WHERE
         projects.id = $1
         AND (
           projects.owner_user_id = $2
           OR memberships.user_id IS NOT NULL
         )
       LIMIT 1`,
      [
        projectId,
        userId,
      ],
    )

    const row = current.rows[0]

    if (!row) throw new CloudProjectNotFoundError()

    if (row.role === 'viewer') throw new CloudProjectPermissionError()

    throw new CloudProjectConflictError(row.revision)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Lock the project while checking its current owner. All four dependent tables
// in migrations 002/003 reference projects(id) ON DELETE CASCADE; no filesystem,
// user/session, Admin, or Radio data is part of this operation.
export async function deleteCloudProject(projectId, userId) {
  requireUserId(userId)
  const client = await getDatabasePool().connect()
  try {
    await client.query('BEGIN')
    const visible = await client.query(
      `SELECT owner_user_id FROM projects
       WHERE id = $1 AND (owner_user_id = $2 OR EXISTS (
         SELECT 1 FROM project_memberships WHERE project_id = $1 AND user_id = $2
       )) FOR UPDATE`, [projectId, userId],
    )
    if (!visible.rows[0]) throw new CloudProjectNotFoundError()
    if (visible.rows[0].owner_user_id !== userId) throw new CloudProjectOwnerRequiredError()
    const deleted = await client.query('DELETE FROM projects WHERE id = $1 AND owner_user_id = $2 RETURNING id', [projectId, userId])
    if (!deleted.rows[0]) throw new CloudProjectNotFoundError()
    await client.query('COMMIT')
    return { deleted: true, projectId }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}


export async function listCloudProjectMembers(
  projectId,
  userId,
) {
  const database =
    getDatabasePool()

  await requireProjectAccess(
    database,
    projectId,
    userId,
  )

  const ownerResult =
    await database.query(
      `SELECT
         users.id AS user_id,
         users.username,
         projects.created_at
       FROM projects
       INNER JOIN users
         ON users.id =
              projects.owner_user_id
       WHERE projects.id = $1
       LIMIT 1`,
      [
        projectId,
      ],
    )

  const owner =
    ownerResult.rows[0]

  if (!owner) {
    throw new CloudProjectNotFoundError()
  }

  const membersResult =
    await database.query(
      `SELECT
         memberships.user_id,
         users.username,
         memberships.role,
         memberships.created_at
       FROM project_memberships
         AS memberships
       INNER JOIN users
         ON users.id =
              memberships.user_id
       WHERE
         memberships.project_id = $1
       ORDER BY
         memberships.created_at ASC,
         users.username ASC`,
      [
        projectId,
      ],
    )

  return [
    {
      userId:
        owner.user_id,

      username:
        owner.username,

      role:
        'owner',

      joinedAt:
        new Date(
          owner.created_at,
        ).toISOString(),
    },

    ...membersResult.rows.map(
      (
        row,
      ) => ({
        userId:
          row.user_id,

        username:
          row.username,

        role:
          row.role,

        joinedAt:
          new Date(
            row.created_at,
          ).toISOString(),
      }),
    ),
  ]
}

export async function addCloudProjectMember(
  projectId,
  {
    userId,
    username,
    role,
  },
) {
  requireMemberRole(
    role,
  )

  const normalizedUsername =
    requireMemberUsername(
      username,
    )

  const database =
    getDatabasePool()

  const ownerUserId =
    await requireProjectOwner(
      database,
      projectId,
      userId,
    )

  const targetResult =
    await database.query(
      `SELECT
         id,
         username
       FROM users
       WHERE
         username = $1
       LIMIT 1`,
      [
        normalizedUsername,
      ],
    )

  const target =
    targetResult.rows[0]

  if (!target) {
    throw new CloudProjectMemberUserNotFoundError()
  }

  if (
    target.id ===
      ownerUserId
  ) {
    throw new CloudProjectMemberAlreadyExistsError()
  }

  const result =
    await database.query(
      `INSERT INTO project_memberships (
         project_id,
         user_id,
         role
       )
       VALUES (
         $1,
         $2,
         $3
       )
       ON CONFLICT (
         project_id,
         user_id
       )
       DO NOTHING
       RETURNING
         user_id,
         role,
         created_at`,
      [
        projectId,
        target.id,
        role,
      ],
    )

  const row =
    result.rows[0]

  if (!row) {
    throw new CloudProjectMemberAlreadyExistsError()
  }

  return {
    userId:
      row.user_id,

    username:
      target.username,

    role:
      row.role,

    joinedAt:
      new Date(
        row.created_at,
      ).toISOString(),
  }
}

export async function updateCloudProjectMember(
  projectId,
  memberUserId,
  {
    userId,
    role,
  },
) {
  requireMemberRole(
    role,
  )

  const database =
    getDatabasePool()

  const ownerUserId =
    await requireProjectOwner(
      database,
      projectId,
      userId,
    )

  if (
    memberUserId ===
      ownerUserId
  ) {
    throw new CloudProjectOwnerImmutableError()
  }

  const result =
    await database.query(
      `UPDATE project_memberships
         AS memberships
       SET
         role = $3,
         updated_at = NOW()
       FROM users
       WHERE
         memberships.project_id = $1
         AND memberships.user_id = $2
         AND users.id =
               memberships.user_id
       RETURNING
         memberships.user_id,
         users.username,
         memberships.role,
         memberships.created_at`,
      [
        projectId,
        memberUserId,
        role,
      ],
    )

  const row =
    result.rows[0]

  if (!row) {
    throw new CloudProjectMemberNotFoundError()
  }

  return {
    userId:
      row.user_id,

    username:
      row.username,

    role:
      row.role,

    joinedAt:
      new Date(
        row.created_at,
      ).toISOString(),
  }
}

export async function removeCloudProjectMember(
  projectId,
  memberUserId,
  userId,
) {
  const database = getDatabasePool()
  const client = await database.connect()

  try {
    await client.query('BEGIN')
    const ownerUserId = await requireProjectOwner(client, projectId, userId)

  if (
    memberUserId ===
      ownerUserId
  ) {
    throw new CloudProjectOwnerImmutableError()
  }

    const result = await client.query(
      `DELETE FROM project_memberships
       WHERE
         project_id = $1
         AND user_id = $2
       RETURNING user_id`,
      [
        projectId,
        memberUserId,
      ],
    )

    if (result.rowCount !== 1) throw new CloudProjectMemberNotFoundError()
    await client.query(
      `DELETE FROM project_assignments WHERE project_id = $1 AND user_id = $2`,
      [projectId, memberUserId],
    )
    await client.query('COMMIT')

    return { userId: result.rows[0].user_id }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
