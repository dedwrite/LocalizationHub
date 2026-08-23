import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'

import {
  promisify,
} from 'node:util'

import {
  getDatabasePool,
} from './database.mjs'

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

function normalizeEmail(
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
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
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
  row,
) {
  return {
    id:
      row.id,

    username:
      row.username,

    email:
      row.email,

    emailVerified:
      row.email_verified_at !==
      null,

    createdAt:
      new Date(
        row.created_at,
      ).toISOString(),
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
      user.password_salt,
    )

  const storedHash =
    Buffer.from(
      user.password_hash,
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

function hashSessionToken(
  token,
) {
  return createHash(
    'sha256',
  )
    .update(
      token,
      'utf8',
    )
    .digest(
      'hex',
    )
}

async function createSession(
  database,
  userId,
) {
  const token =
    randomBytes(
      32,
    ).toString(
      'base64url',
    )

  const tokenHash =
    hashSessionToken(
      token,
    )

  const expiresAt =
    new Date(
      Date.now() +
        SESSION_TTL_MS,
    )

  await database.query(
    `INSERT INTO sessions (
       token_hash,
       user_id,
       expires_at
     )
     VALUES (
       $1,
       $2,
       $3
     )`,
    [
      tokenHash,
      userId,
      expiresAt,
    ],
  )

  return {
    token,

    expiresAt:
      expiresAt
        .toISOString(),
  }
}

function mapDatabaseError(
  error,
) {
  if (
    !error ||
    typeof error !==
      'object'
  ) {
    return null
  }

  if (
    error.code !==
      '23505'
  ) {
    return null
  }

  if (
    error.constraint ===
      'users_username_unique'
  ) {
    return new AuthError(
      'username-taken',
      'That username is already in use.',
    )
  }

  if (
    error.constraint ===
      'users_email_lower_unique' ||
    error.constraint ===
      'users_email_lower_unique_idx'
  ) {
    return new AuthError(
      'email-taken',
      'That email address is already in use.',
    )
  }

  return null
}

export async function registerUser({
  username,
  email,
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

  const normalizedEmail =
    normalizeEmail(
      email,
    )

  if (!normalizedEmail) {
    throw new AuthError(
      'email-invalid',
      'Enter a valid email address.',
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

  const database =
    getDatabasePool()

  const client =
    await database.connect()

  try {
    await client.query(
      'BEGIN',
    )

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

    const userResult =
      await client.query(
        `INSERT INTO users (
           id,
           username,
           email,
           password_salt,
           password_hash
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5
         )
         RETURNING
           id,
           username,
           email,
           email_verified_at,
           created_at`,
        [
          randomUUID(),
          normalizedUsername,
          normalizedEmail,
          passwordSalt,
          passwordHash.toString(
            'base64',
          ),
        ],
      )

    const user =
      userResult.rows[0]

    const session =
      await createSession(
        client,
        user.id,
      )

    await client.query(
      'COMMIT',
    )

    return {
      user:
        toPublicUser(
          user,
        ),

      ...session,
    }
  } catch (
    error
  ) {
    try {
      await client.query(
        'ROLLBACK',
      )
    } catch {
      // Preserve the original error.
    }

    const mapped =
      mapDatabaseError(
        error,
      )

    if (mapped) {
      throw mapped
    }

    throw error
  } finally {
    client.release()
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

  const database =
    getDatabasePool()

  const result =
    await database.query(
      `SELECT
         id,
         username,
         email,
         password_salt,
         password_hash,
         email_verified_at,
         created_at
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [
        normalizedUsername,
      ],
    )

  const user =
    result.rows[0]

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
    await createSession(
      database,
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

export async function authenticateToken(
  token,
) {
  if (
    typeof token !==
      'string' ||
    token.length === 0
  ) {
    return null
  }

  const tokenHash =
    hashSessionToken(
      token,
    )

  const database =
    getDatabasePool()

  const result =
    await database.query(
      `SELECT
         u.id,
         u.username,
         u.email,
         u.email_verified_at,
         u.created_at,
         s.expires_at
       FROM sessions s
       INNER JOIN users u
         ON u.id = s.user_id
       WHERE s.token_hash = $1
       LIMIT 1`,
      [
        tokenHash,
      ],
    )

  const row =
    result.rows[0]

  if (!row) {
    return null
  }

  if (
    new Date(
      row.expires_at,
    ).getTime() <=
      Date.now()
  ) {
    await database.query(
      `DELETE FROM sessions
       WHERE token_hash = $1`,
      [
        tokenHash,
      ],
    )

    return null
  }

  return toPublicUser(
    row,
  )
}

export async function logoutUser(
  token,
) {
  if (
    typeof token !==
      'string'
  ) {
    return false
  }

  const database =
    getDatabasePool()

  const result =
    await database.query(
      `DELETE FROM sessions
       WHERE token_hash = $1`,
    [
      hashSessionToken(
        token,
      ),
    ],
  )

  return (
    result.rowCount >
    0
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
