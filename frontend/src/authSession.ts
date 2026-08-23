export type AuthUser = {
  id:
    string

  username:
    string

  createdAt:
    string
}

export type AuthSession = {
  user:
    AuthUser

  token:
    string

  expiresAt:
    string
}

const STORAGE_KEY =
  'localizationhub.auth-session'

function isAuthUser(
  value:
    unknown,
): value is AuthUser {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const candidate =
    value as Partial<
      AuthUser
    >

  return (
    typeof candidate.id ===
      'string' &&
    candidate.id.length > 0 &&
    typeof candidate.username ===
      'string' &&
    candidate.username.length > 0 &&
    typeof candidate.createdAt ===
      'string'
  )
}

function isAuthSession(
  value:
    unknown,
): value is AuthSession {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const candidate =
    value as Partial<
      AuthSession
    >

  if (
    !isAuthUser(
      candidate.user,
    ) ||
    typeof candidate.token !==
      'string' ||
    candidate.token.length === 0 ||
    typeof candidate.expiresAt !==
      'string'
  ) {
    return false
  }

  const expiresAt =
    Date.parse(
      candidate.expiresAt,
    )

  return (
    Number.isFinite(
      expiresAt,
    ) &&
    expiresAt >
      Date.now()
  )
}

export function getAuthSession():
  AuthSession | null {
  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY,
      )

    if (!raw) {
      return null
    }

    const parsed:
      unknown =
      JSON.parse(
        raw,
      )

    if (
      !isAuthSession(
        parsed,
      )
    ) {
      clearAuthSession()

      return null
    }

    return parsed
  } catch (
    error
  ) {
    console.error(
      'Failed to read authentication session.',
      error,
    )

    clearAuthSession()

    return null
  }
}

export function rememberAuthSession(
  session:
    AuthSession,
): AuthSession {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      session,
    ),
  )

  return session
}

export function clearAuthSession():
  void {
  window.localStorage.removeItem(
    STORAGE_KEY,
  )
}

export function getAuthToken():
  string | null {
  return (
    getAuthSession()
      ?.token ??
    null
  )
}
