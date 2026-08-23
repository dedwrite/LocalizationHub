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
  name,
  project,
}) {
  const id =
    randomUUID()

  const record = {
    id,

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

export function listCloudProjects() {
  return Array.from(
    projects.values(),
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
) {
  const record =
    projects.get(
      projectId,
    )

  if (!record) {
    throw new CloudProjectNotFoundError()
  }

  return toSnapshot(
    record,
  )
}

export function saveCloudProject(
  projectId,
  {
    project,
    baseRevision,
  },
) {
  const record =
    projects.get(
      projectId,
    )

  if (!record) {
    throw new CloudProjectNotFoundError()
  }

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
