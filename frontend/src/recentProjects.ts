export type RecentProject = {
  path:
    string

  sourceFileName:
    string

  lastOpenedAt:
    number
}

const STORAGE_KEY =
  'localizationhub.recent-projects'

const MAX_RECENT_PROJECTS =
  6

function isRecentProject(
  value: unknown,
): value is RecentProject {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return false
  }

  const candidate =
    value as Partial<RecentProject>

  return (
    typeof candidate.path ===
      'string' &&
    candidate.path.trim() !==
      '' &&
    typeof candidate.sourceFileName ===
      'string' &&
    typeof candidate.lastOpenedAt ===
      'number' &&
    Number.isFinite(
      candidate.lastOpenedAt,
    )
  )
}

export function getRecentProjects():
  RecentProject[] {
  try {
    const stored =
      window.localStorage.getItem(
        STORAGE_KEY,
      )

    if (
      !stored
    ) {
      return []
    }

    const parsed:
      unknown =
        JSON.parse(
          stored,
        )

    if (
      !Array.isArray(
        parsed,
      )
    ) {
      return []
    }

    return parsed
      .filter(
        isRecentProject,
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.lastOpenedAt -
          left.lastOpenedAt,
      )
      .slice(
        0,
        MAX_RECENT_PROJECTS,
      )
  } catch (
    error
  ) {
    console.warn(
      'Failed to read recent projects.',
      error,
    )

    return []
  }
}

export function rememberRecentProject(
  path: string,
  sourceFileName: string,
): RecentProject[] {
  const normalizedPath =
    path.trim()

  if (
    normalizedPath ===
    ''
  ) {
    return getRecentProjects()
  }

  const current =
    getRecentProjects()

  /*
   * نفس المشروع ما يتكرر.
   *
   * إذا فتحناه مرة ثانية،
   * نطلعه فوق القائمة.
   */
  const withoutCurrent =
    current.filter(
      (project) =>
        project.path !==
        normalizedPath,
    )

  const updated:
    RecentProject[] = [
      {
        path:
          normalizedPath,

        sourceFileName:
          sourceFileName ||
          'Localization Project',

        lastOpenedAt:
          Date.now(),
      },

      ...withoutCurrent,
    ].slice(
      0,
      MAX_RECENT_PROJECTS,
    )

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        updated,
      ),
    )
  } catch (
    error
  ) {
    console.warn(
      'Failed to save recent projects.',
      error,
    )
  }

  return updated
}

export function removeRecentProject(
  path: string,
): RecentProject[] {
  const updated =
    getRecentProjects()
      .filter(
        (project) =>
          project.path !==
          path,
      )

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        updated,
      ),
    )
  } catch (
    error
  ) {
    console.warn(
      'Failed to update recent projects.',
      error,
    )
  }

  return updated
}

export function clearRecentProjects():
  void {
  try {
    window.localStorage.removeItem(
      STORAGE_KEY,
    )
  } catch (
    error
  ) {
    console.warn(
      'Failed to clear recent projects.',
      error,
    )
  }
}

export function getRecentProjectDisplayPath(
  path: string,
): string {
  const normalized =
    path.replace(
      /\\/g,
      '/',
    )

  const parts =
    normalized
      .split('/')
      .filter(Boolean)

  /*
   * بدل ما نعرض:
   *
   * H:\Games\Localization\Projects\game.lhproj
   *
   * نعرض آخر جزئين تقريبًا:
   *
   * Projects / game.lhproj
   */
  if (
    parts.length <=
    2
  ) {
    return parts.join(
      ' / ',
    )
  }

  return parts
    .slice(-2)
    .join(
      ' / ',
    )
}