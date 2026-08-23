import {
  randomUUID,
} from 'node:crypto'

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

/*
 * Temporary development store.
 *
 * This intentionally lives behind a small API
 * so it can be replaced with PostgreSQL later
 * without changing the HTTP contract.
 *
 * Data is lost whenever the relay restarts.
 */
const projects =
  new Map()

function nowIso() {
  return new Date()
    .toISOString()
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

function getOwnedRecord(
  projectId,
  userId,
) {
  requireUserId(
    userId,
  )

  const record =
    projects.get(
      projectId,
    )

  /*
   * Intentionally return the same error for:
   * - missing project
   * - project owned by another user
   *
   * This prevents leaking whether a Cloud Project
   * UUID exists to an unauthorized account.
   */
  if (
    !record ||
    record.ownerUserId !==
      userId
  ) {
    throw new CloudProjectNotFoundError()
  }

  return record
}

function toSnapshot(
  record,
) {
  return {
    id:
      record.id,

    name:
      record.name,

    role:
      'owner',

    revision:
      record.revision,

    updatedAt:
      record.updatedAt,

    project:
      record.project,
  }
}

export function createCloudProject({
  ownerUserId,
  name,
  project,
}) {
  requireUserId(
    ownerUserId,
  )

  const id =
    randomUUID()

  const record = {
    id,

    ownerUserId,

    name,

    revision:
      1,

    updatedAt:
      nowIso(),

    project,
  }

  projects.set(
    id,
    record,
  )

  return toSnapshot(
    record,
  )
}

export function listCloudProjects(
  userId,
) {
  requireUserId(
    userId,
  )

  return Array.from(
    projects.values(),
  )
    .filter(
      (record) =>
        record.ownerUserId ===
        userId,
    )
    .map(
      (record) => ({
        id:
          record.id,

        name:
          record.name,

        sourceFileName:
          record.project
            .sourceFileName,

        role:
          'owner',

        revision:
          record.revision,

        updatedAt:
          record.updatedAt,
      }),
    )
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(
          a.updatedAt,
        ),
    )
}

export function getCloudProject(
  projectId,
  userId,
) {
  const record =
    getOwnedRecord(
      projectId,
      userId,
    )

  return toSnapshot(
    record,
  )
}

export function saveCloudProject(
  projectId,
  {
    userId,
    project,
    baseRevision,
  },
) {
  const record =
    getOwnedRecord(
      projectId,
      userId,
    )

  if (
    baseRevision !==
    record.revision
  ) {
    throw new CloudProjectConflictError(
      record.revision,
    )
  }

  record.project =
    project

  record.revision +=
    1

  record.updatedAt =
    nowIso()

  return toSnapshot(
    record,
  )
}
