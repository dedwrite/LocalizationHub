import {
  clearAuthSession,
  getAuthSession,
  rememberAuthSession,
  type AuthSession,
  type AuthUser,
} from './authSession'

type AuthApiErrorCode =
  | 'disabled'
  | 'network-error'
  | 'invalid-response'
  | 'invalid-request'
  | 'username-invalid'
  | 'email-invalid'
  | 'password-invalid'
  | 'username-taken'
  | 'email-taken'
  | 'invalid-credentials'
  | 'unauthorized'
  | 'not-found'
  | 'internal-error'

export class AuthApiError
  extends Error {
  readonly code:
    AuthApiErrorCode

  constructor(
    code:
      AuthApiErrorCode,

    message:
      string,
  ) {
    super(message)

    this.name =
      'AuthApiError'

    this.code =
      code
  }
}

function getAuthApiBaseUrl():
  string {
  const configured =
    import.meta.env
      .VITE_CLOUD_API_URL
      ?.trim()

  if (configured) {
    return configured
      .replace(/\/$/, '')
  }

  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8787'
  }

  throw new AuthApiError(
    'disabled',
    'Authentication is not enabled in this build.',
  )
}

async function requestJson<T>(
  path:
    string,

  {
    token,
    ...init
  }:
    RequestInit & {
      token?:
        string
    } = {},
): Promise<T> {
  const baseUrl =
    getAuthApiBaseUrl()

  let response:
    Response

  try {
    response =
      await fetch(
        `${baseUrl}${path}`,
        {
          ...init,

          headers: {
            Accept:
              'application/json',

            ...(init.body
              ? {
                  'Content-Type':
                    'application/json; charset=utf-8',
                }
              : {}),

            ...(token
              ? {
                  Authorization:
                    `Bearer ${token}`,
                }
              : {}),

            ...init.headers,
          },
        },
      )
  } catch {
    throw new AuthApiError(
      'network-error',
      'Could not connect to the authentication service.',
    )
  }

  let body:
    unknown

  try {
    body =
      await response.json()
  } catch {
    throw new AuthApiError(
      'invalid-response',
      'Authentication service returned an invalid response.',
    )
  }

  if (!response.ok) {
    const errorBody =
      body as {
        error?:
          unknown

        message?:
          unknown
      }

    const code =
      typeof errorBody.error ===
        'string'
        ? errorBody.error
        : 'invalid-response'

    const message =
      typeof errorBody.message ===
        'string'
        ? errorBody.message
        : null

    const knownCodes:
      AuthApiErrorCode[] = [
        'invalid-request',
        'username-invalid',
        'email-invalid',
        'password-invalid',
        'username-taken',
        'email-taken',
        'invalid-credentials',
        'unauthorized',
        'not-found',
        'internal-error',
      ]

    const normalizedCode =
      knownCodes.includes(
        code as
          AuthApiErrorCode,
      )
        ? code as
            AuthApiErrorCode
        : 'invalid-response'

    throw new AuthApiError(
      normalizedCode,
      message ??
        'Authentication request failed.',
    )
  }

  return body as T
}

type AuthSessionResponse = {
  user:
    AuthUser

  token:
    string

  expiresAt:
    string
}

type CurrentUserResponse = {
  user:
    AuthUser
}

export async function registerAccount(
  username:
    string,

  email:
    string,

  password:
    string,
): Promise<AuthSession> {
  const session =
    await requestJson<
      AuthSessionResponse
    >(
      '/api/auth/register',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            username,
            email,
            password,
          }),
      },
    )

  return rememberAuthSession(
    session,
  )
}

export async function loginAccount(
  username:
    string,

  password:
    string,
): Promise<AuthSession> {
  const session =
    await requestJson<
      AuthSessionResponse
    >(
      '/api/auth/login',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            username,
            password,
          }),
      },
    )

  return rememberAuthSession(
    session,
  )
}

export async function getCurrentAuthUser(
  token:
    string,
): Promise<AuthUser> {
  const response =
    await requestJson<
      CurrentUserResponse
    >(
      '/api/auth/me',
      {
        token,
      },
    )

  return response.user
}

/*
 * Restore a persisted session by asking
 * the server whether its token is still valid.
 *
 * Invalid tokens are removed locally.
 * Network failures do not destroy the session.
 */
export async function restoreAuthSession():
  Promise<AuthSession | null> {
  const stored =
    getAuthSession()

  if (!stored) {
    return null
  }

  try {
    const user =
      await getCurrentAuthUser(
        stored.token,
      )

    return rememberAuthSession({
      ...stored,
      user,
    })
  } catch (
    error
  ) {
    if (
      error instanceof
        AuthApiError &&
      error.code ===
        'unauthorized'
    ) {
      clearAuthSession()

      return null
    }

    throw error
  }
}

export async function logoutAccount():
  Promise<void> {
  const stored =
    getAuthSession()

  if (!stored) {
    clearAuthSession()

    return
  }

  try {
    await requestJson<{
      ok:
        boolean
    }>(
      '/api/auth/logout',
      {
        method:
          'POST',

        token:
          stored.token,
      },
    )
  } finally {
    clearAuthSession()
  }
}

export function getAuthErrorMessage(
  error:
    unknown,

  fallback:
    string,
): string {
  if (
    error instanceof
      AuthApiError
  ) {
    return error.message
  }

  return fallback
}
