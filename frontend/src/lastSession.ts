export type LastSession = {
  projectPath: string
  sourceFileName: string
  savedAt: number
}

const STORAGE_KEY =
  'localizationhub.last-session'

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
      ) as Partial<LastSession>

    if (
      typeof parsed.projectPath !==
        'string' ||
      parsed.projectPath.trim() ===
        '' ||
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

    return {
      projectPath:
        parsed.projectPath,

      sourceFileName:
        parsed.sourceFileName,

      savedAt:
        parsed.savedAt,
    }
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
  projectPath:
    string,

  sourceFileName:
    string,
) {
  const session:
    LastSession = {
      projectPath,
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