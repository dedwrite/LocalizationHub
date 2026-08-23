import {
  createHash,
  randomBytes,
} from 'node:crypto'

import {
  getDatabasePool,
} from './database.mjs'

function readPositiveInteger(
  value,
  fallback,
) {
  const parsed =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <= 0
  ) {
    return fallback
  }

  return Math.floor(
    parsed,
  )
}

const TOKEN_TTL_MS =
  readPositiveInteger(
    process.env.EMAIL_VERIFICATION_TOKEN_TTL_MS,
    30 * 60 * 1000,
  )

const RESEND_COOLDOWN_MS =
  readPositiveInteger(
    process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
    60 * 1000,
  )

export class EmailVerificationUserNotFoundError
  extends Error {
  constructor() {
    super(
      'Verification user was not found.',
    )

    this.name =
      'EmailVerificationUserNotFoundError'
  }
}

export class EmailVerificationCooldownError
  extends Error {
  constructor(
    retryAfterSeconds,
  ) {
    super(
      'Please wait before requesting another verification email.',
    )

    this.name =
      'EmailVerificationCooldownError'

    this.retryAfterSeconds =
      retryAfterSeconds
  }
}

export class EmailVerificationTokenError
  extends Error {
  constructor(
    code,
    message,
  ) {
    super(
      message,
    )

    this.name =
      'EmailVerificationTokenError'

    this.code =
      code
  }
}

function requireUserId(
  userId,
) {
  if (
    typeof userId !==
      'string' ||
    userId.length === 0
  ) {
    throw new TypeError(
      'User ID is required.',
    )
  }

  return userId
}

function hashToken(
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

export async function getEmailVerificationStatus(
  userId,
) {
  requireUserId(
    userId,
  )

  const database =
    getDatabasePool()

  const result =
    await database.query(
      `SELECT
         id,
         username,
         email,
         email_verified_at,
         created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [
        userId,
      ],
    )

  const row =
    result.rows[0]

  if (!row) {
    throw new EmailVerificationUserNotFoundError()
  }

  return toPublicUser(
    row,
  )
}

export async function requestEmailVerification(
  userId,
) {
  requireUserId(
    userId,
  )

  const database =
    getDatabasePool()

  const client =
    await database.connect()

  let committed =
    false

  try {
    await client.query(
      'BEGIN',
    )

    /*
     * Lock the user row so simultaneous resend
     * requests cannot create multiple active
     * verification tokens.
     */
    const userResult =
      await client.query(
        `SELECT
           id,
           username,
           email,
           email_verified_at,
           created_at
         FROM users
         WHERE id = $1
         LIMIT 1
         FOR UPDATE`,
        [
          userId,
        ],
      )

    const user =
      userResult.rows[0]

    if (!user) {
      throw new EmailVerificationUserNotFoundError()
    }

    if (
      user.email_verified_at !==
        null
    ) {
      await client.query(
        'COMMIT',
      )

      committed =
        true

      return {
        alreadyVerified:
          true,

        user:
          toPublicUser(
            user,
          ),

        token:
          null,

        expiresAt:
          null,
      }
    }

    /*
     * Remove tokens that are no longer useful.
     */
    await client.query(
      `DELETE FROM email_verification_tokens
       WHERE user_id = $1
         AND (
           used_at IS NOT NULL
           OR expires_at <= NOW()
         )`,
      [
        userId,
      ],
    )

    const latestResult =
      await client.query(
        `SELECT created_at
         FROM email_verification_tokens
         WHERE user_id = $1
           AND used_at IS NULL
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [
          userId,
        ],
      )

    const latest =
      latestResult.rows[0]

    if (latest) {
      const elapsed =
        Date.now() -
        new Date(
          latest.created_at,
        ).getTime()

      if (
        elapsed <
          RESEND_COOLDOWN_MS
      ) {
        const remaining =
          RESEND_COOLDOWN_MS -
          elapsed

        throw new EmailVerificationCooldownError(
          Math.max(
            1,
            Math.ceil(
              remaining /
                1000,
            ),
          ),
        )
      }
    }

    /*
     * Keep only one currently usable token.
     */
    await client.query(
      `DELETE FROM email_verification_tokens
       WHERE user_id = $1
         AND used_at IS NULL`,
      [
        userId,
      ],
    )

    const token =
      randomBytes(
        32,
      ).toString(
        'base64url',
      )

    const tokenHash =
      hashToken(
        token,
      )

    const expiresAt =
      new Date(
        Date.now() +
          TOKEN_TTL_MS,
      )

    await client.query(
      `INSERT INTO email_verification_tokens (
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

    await client.query(
      'COMMIT',
    )

    committed =
      true

    /*
     * Raw token is returned only to trusted
     * server code so the email provider can
     * put it into the verification link.
     *
     * It must never be returned from the
     * public HTTP API.
     */
    return {
      alreadyVerified:
        false,

      user:
        toPublicUser(
          user,
        ),

      token,

      expiresAt:
        expiresAt.toISOString(),
    }
  } catch (
    error
  ) {
    if (!committed) {
      try {
        await client.query(
          'ROLLBACK',
        )
      } catch {
        // Preserve the original error.
      }
    }

    throw error
  } finally {
    client.release()
  }
}

export async function verifyEmailToken(
  token,
) {
  if (
    typeof token !==
      'string' ||
    token.length < 20 ||
    token.length > 512
  ) {
    throw new EmailVerificationTokenError(
      'verification-token-invalid',
      'Email verification token is invalid.',
    )
  }

  const tokenHash =
    hashToken(
      token,
    )

  const database =
    getDatabasePool()

  const client =
    await database.connect()

  let committed =
    false

  try {
    await client.query(
      'BEGIN',
    )

    const tokenResult =
      await client.query(
        `SELECT
           t.token_hash,
           t.user_id,
           t.expires_at,
           t.used_at,
           u.id,
           u.username,
           u.email,
           u.email_verified_at,
           u.created_at
         FROM email_verification_tokens t
         INNER JOIN users u
           ON u.id = t.user_id
         WHERE t.token_hash = $1
         LIMIT 1
         FOR UPDATE OF t, u`,
        [
          tokenHash,
        ],
      )

    const record =
      tokenResult.rows[0]

    if (!record) {
      throw new EmailVerificationTokenError(
        'verification-token-invalid',
        'Email verification token is invalid.',
      )
    }

    if (
      record.used_at !==
        null
    ) {
      throw new EmailVerificationTokenError(
        'verification-token-invalid',
        'Email verification token has already been used.',
      )
    }

    if (
      new Date(
        record.expires_at,
      ).getTime() <=
        Date.now()
    ) {
      await client.query(
        `DELETE FROM email_verification_tokens
         WHERE token_hash = $1`,
        [
          tokenHash,
        ],
      )

      await client.query(
        'COMMIT',
      )

      committed =
        true

      throw new EmailVerificationTokenError(
        'verification-token-expired',
        'Email verification token has expired.',
      )
    }

    const userResult =
      await client.query(
        `UPDATE users
         SET
           email_verified_at =
             COALESCE(
               email_verified_at,
               NOW()
             )
         WHERE id = $1
         RETURNING
           id,
           username,
           email,
           email_verified_at,
           created_at`,
        [
          record.user_id,
        ],
      )

    await client.query(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE token_hash = $1`,
      [
        tokenHash,
      ],
    )

    /*
     * Verification succeeded, so every other
     * token for this account becomes useless.
     */
    await client.query(
      `DELETE FROM email_verification_tokens
       WHERE user_id = $1
         AND token_hash <> $2`,
      [
        record.user_id,
        tokenHash,
      ],
    )

    await client.query(
      'COMMIT',
    )

    committed =
      true

    return toPublicUser(
      userResult.rows[0],
    )
  } catch (
    error
  ) {
    if (!committed) {
      try {
        await client.query(
          'ROLLBACK',
        )
      } catch {
        // Preserve the original error.
      }
    }

    throw error
  } finally {
    client.release()
  }
}
