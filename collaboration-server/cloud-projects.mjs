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

  const database =
    getDatabasePool()

  const result =
    await database.query(
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
      [
        projectId,
        userId,
        JSON.stringify(
          project,
        ),
        baseRevision,
      ],
    )

  if (
    result.rowCount ===
      1
  ) {
    return toSnapshot(
      result.rows[0],
    )
  }

  const current =
    await database.query(
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

  const row =
    current.rows[0]

  if (!row) {
    throw new CloudProjectNotFoundError()
  }

  if (
    row.role ===
      'viewer'
  ) {
    throw new CloudProjectPermissionError()
  }

  throw new CloudProjectConflictError(
    row.revision,
  )
}
