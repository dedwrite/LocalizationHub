import type {
  ProjectLocation,
} from '@localizationhub/core'

export type LastSession = {
  location:
    ProjectLocation

  sourceFileName:
    string

  savedAt:
    number
}

type LegacyLastSession = {
  projectPath:
    string

  sourceFileName:
    string

  savedAt:
    number
}

const STORAGE_KEY =
  'localizationhub.last-session'

function isProjectLocation(
  value:
    unknown,
): value is ProjectLocation {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const candidate =
    value as {
      kind?:
        unknown

      path?:
        unknown

      projectId?:
        unknown
    }

  if (
    candidate.kind ===
      'local'
  ) {
    return (
      typeof candidate.path ===
        'string' &&
      candidate.path.trim()
        .length > 0
    )
  }

  if (
    candidate.kind ===
      'cloud'
  ) {
    return (
      typeof candidate.projectId ===
        'string' &&
      candidate.projectId.trim()
        .length > 0
    )
  }

  return false
}

export function getLastSession():
  LastSession | null {
  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY,
      )

    if (!raw) {
      return null
    }

    const parsed =
      JSON.parse(
        raw,
      ) as Partial<
        LastSession &
        LegacyLastSession
      >

    if (
      typeof parsed.sourceFileName !==
        'string' ||
      parsed.sourceFileName.trim() ===
        '' ||
      typeof parsed.savedAt !==
        'number'
    ) {
      clearLastSession()

      return null
    }

    if (
      isProjectLocation(
        parsed.location,
      )
    ) {
      return {
        location:
          parsed.location,

        sourceFileName:
          parsed.sourceFileName,

        savedAt:
          parsed.savedAt,
      }
    }

    /*
     * Migrate the pre-cloud Last Session shape:
     *
     * projectPath -> location.local.path
     */
    if (
      typeof parsed.projectPath ===
        'string' &&
      parsed.projectPath.trim() !==
        ''
    ) {
      const migrated:
        LastSession = {
          location: {
            kind:
              'local',

            path:
              parsed.projectPath,
          },

          sourceFileName:
            parsed.sourceFileName,

          savedAt:
            parsed.savedAt,
        }

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          migrated,
        ),
      )

      return migrated
    }

    clearLastSession()

    return null
  } catch (
    error
  ) {
    console.error(
      'Failed to read last session.',
      error,
    )

    clearLastSession()

    return null
  }
}

export function rememberLastSession(
  location:
    ProjectLocation,

  sourceFileName:
    string,
) {
  const session:
    LastSession = {
      location,
      sourceFileName,
      savedAt:
        Date.now(),
    }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      session,
    ),
  )

  return session
}

export function clearLastSession() {
  window.localStorage.removeItem(
    STORAGE_KEY,
  )
}
