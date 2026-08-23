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
      'owner',

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
         project`,
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
         id,
         name,
         project ->> 'sourceFileName'
           AS source_file_name,
         revision,
         updated_at
       FROM projects
       WHERE owner_user_id = $1
       ORDER BY updated_at DESC`,
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
        'owner',

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
         id,
         name,
         revision,
         updated_at,
         project
       FROM projects
       WHERE id = $1
         AND owner_user_id = $2
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
       WHERE id = $1
         AND owner_user_id = $2
         AND revision = $4
       RETURNING
         id,
         name,
         revision,
         updated_at,
         project`,
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
      `SELECT revision
       FROM projects
       WHERE id = $1
         AND owner_user_id = $2
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

  throw new CloudProjectConflictError(
    row.revision,
  )
}
