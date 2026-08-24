import type {
  DecodeLocalizationProjectResult,
  LocalizationProjectV2,
} from './projectModel'

import type {
  CloudProjectRole,
} from './cloudProjects'

export type ProjectLocation =
  | {
      kind:
        'local'

      path:
        string
    }
  | {
      kind:
        'cloud'

      projectId:
        string
    }

export type LoadedProject = {
  project:
    LocalizationProjectV2

  migratedFromVersion:
    1 | null

  revision:
    number | null

  cloudRole:
    CloudProjectRole | null
}

export type SavedProject = {
  revision:
    number | null
}

export type ProjectSaveOptions = {
  baseRevision?:
    number | null
}

export type ProjectDecodeFailureReason =
  Extract<
    DecodeLocalizationProjectResult,
    { ok: false }
  >['reason']

export class ProjectStorageError
  extends Error {
  readonly code:
    | 'read-failed'
    | 'write-failed'
    | ProjectDecodeFailureReason

  constructor(
    code:
      | 'read-failed'
      | 'write-failed'
      | ProjectDecodeFailureReason,

    message: string,
  ) {
    super(message)

    this.name =
      'ProjectStorageError'

    this.code =
      code
  }
}

export interface ProjectStorage {
  load(
    location:
      ProjectLocation,
  ): Promise<LoadedProject>

  save(
    location:
      ProjectLocation,

    project:
      LocalizationProjectV2,

    options?:
      ProjectSaveOptions,
  ): Promise<SavedProject>
}
