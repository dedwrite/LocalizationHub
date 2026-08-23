import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'

import {
  promisify,
} from 'node:util'

const scrypt =
  promisify(
    scryptCallback,
  )

const PASSWORD_HASH_BYTES =
  64

const SESSION_TTL_MS =
  Number(
    process.env.AUTH_SESSION_TTL_MS ??
      7 * 24 * 60 * 60 * 1000,
  )

const usersById =
  new Map()

const usersByUsername =
  new Map()

const sessions =
  new Map()

export class AuthError
  extends Error {
  constructor(
    code,
    message,
  ) {
    super(message)

    this.name =
      'AuthError'

    this.code =
      code
  }
}

function nowIso() {
  return new Date()
    .toISOString()
}

function normalizeUsername(
  value,
) {
  if (
    typeof value !==
      'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .toLowerCase()

  if (
    normalized.length < 3 ||
    normalized.length > 32 ||
    !/^[a-z0-9._-]+$/.test(
      normalized,
    )
  ) {
    return null
  }

  return normalized
}

function validatePassword(
  value,
) {
  return (
    typeof value ===
      'string' &&
    value.length >= 8 &&
    value.length <= 128
  )
}

function toPublicUser(
  user,
) {
  return {
    id:
      user.id,

    username:
      user.username,

    createdAt:
      user.createdAt,
  }
}

async function hashPassword(
  password,
  salt,
) {
  const derived =
    await scrypt(
      password,
      salt,
      PASSWORD_HASH_BYTES,
    )

  return Buffer.from(
    derived,
  )
}

async function verifyPassword(
  password,
  user,
) {
  const attemptedHash =
    await hashPassword(
      password,
      user.passwordSalt,
    )

  const storedHash =
    Buffer.from(
      user.passwordHash,
      'base64',
    )

  if (
    attemptedHash.length !==
      storedHash.length
  ) {
    return false
  }

  return timingSafeEqual(
    attemptedHash,
    storedHash,
  )
}

function createSession(
  userId,
) {
  const token =
    randomBytes(
      32,
    ).toString(
      'base64url',
    )

  const createdAt =
    Date.now()

  const session = {
    token,

    userId,

    createdAt,

    expiresAt:
      createdAt +
      SESSION_TTL_MS,
  }

  sessions.set(
    token,
    session,
  )

  return {
    token,

    expiresAt:
      new Date(
        session.expiresAt,
      ).toISOString(),
  }
}

function getActiveSession(
  token,
) {
  if (
    typeof token !==
      'string' ||
    token.length === 0
  ) {
    return null
  }

  const session =
    sessions.get(
      token,
    )

  if (!session) {
    return null
  }

  if (
    session.expiresAt <=
      Date.now()
  ) {
    sessions.delete(
      token,
    )

    return null
  }

  return session
}

export async function registerUser({
  username,
  password,
}) {
  const normalizedUsername =
    normalizeUsername(
      username,
    )

  if (!normalizedUsername) {
    throw new AuthError(
      'username-invalid',
      'Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.',
    )
  }

  if (
    !validatePassword(
      password,
    )
  ) {
    throw new AuthError(
      'password-invalid',
      'Password must be between 8 and 128 characters.',
    )
  }

  if (
    usersByUsername.has(
      normalizedUsername,
    )
  ) {
    throw new AuthError(
      'username-taken',
      'That username is already in use.',
    )
  }

  const passwordSalt =
    randomBytes(
      16,
    ).toString(
      'base64',
    )

  const passwordHash =
    await hashPassword(
      password,
      passwordSalt,
    )

  const user = {
    id:
      randomUUID(),

    username:
      normalizedUsername,

    passwordSalt,

    passwordHash:
      passwordHash.toString(
        'base64',
      ),

    createdAt:
      nowIso(),
  }

  usersById.set(
    user.id,
    user,
  )

  usersByUsername.set(
    user.username,
    user,
  )

  const session =
    createSession(
      user.id,
    )

  return {
    user:
      toPublicUser(
        user,
      ),

    ...session,
  }
}

export async function loginUser({
  username,
  password,
}) {
  const normalizedUsername =
    normalizeUsername(
      username,
    )

  if (
    !normalizedUsername ||
    typeof password !==
      'string'
  ) {
    throw new AuthError(
      'invalid-credentials',
      'Username or password is incorrect.',
    )
  }

  const user =
    usersByUsername.get(
      normalizedUsername,
    )

  if (
    !user ||
    !await verifyPassword(
      password,
      user,
    )
  ) {
    throw new AuthError(
      'invalid-credentials',
      'Username or password is incorrect.',
    )
  }

  const session =
    createSession(
      user.id,
    )

  return {
    user:
      toPublicUser(
        user,
      ),

    ...session,
  }
}

export function authenticateToken(
  token,
) {
  const session =
    getActiveSession(
      token,
    )

  if (!session) {
    return null
  }

  const user =
    usersById.get(
      session.userId,
    )

  if (!user) {
    sessions.delete(
      token,
    )

    return null
  }

  return toPublicUser(
    user,
  )
}

export function logoutUser(
  token,
) {
  if (
    typeof token !==
      'string'
  ) {
    return false
  }

  return sessions.delete(
    token,
  )
}

export function getBearerToken(
  authorizationHeader,
) {
  if (
    typeof authorizationHeader !==
      'string'
  ) {
    return null
  }

  const match =
    authorizationHeader.match(
      /^Bearer\s+(.+)$/i,
    )

  if (!match) {
    return null
  }

  const token =
    match[1].trim()

  return token ||
    null
}
