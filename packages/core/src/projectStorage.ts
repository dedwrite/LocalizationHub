import type {
  DecodeLocalizationProjectResult,
  LocalizationProjectV2,
} from './projectModel'

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
  ): Promise<void>
}
