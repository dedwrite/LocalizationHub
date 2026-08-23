import {
  createHash,
} from 'node:crypto'

const RESEND_API_URL =
  'https://api.resend.com/emails'

export class EmailDeliveryConfigurationError
  extends Error {
  constructor(
    message,
  ) {
    super(
      message,
    )

    this.name =
      'EmailDeliveryConfigurationError'
  }
}

export class EmailDeliveryError
  extends Error {
  constructor(
    message,
    {
      statusCode =
        null,

      providerCode =
        null,
    } = {},
  ) {
    super(
      message,
    )

    this.name =
      'EmailDeliveryError'

    this.statusCode =
      statusCode

    this.providerCode =
      providerCode
  }
}

function requireEnvironment(
  name,
) {
  const value =
    process.env[name]
      ?.trim()

  if (!value) {
    throw new EmailDeliveryConfigurationError(
      `${name} is required for email delivery.`,
    )
  }

  return value
}

function escapeHtml(
  value,
) {
  return String(
    value,
  )
    .replaceAll(
      '&',
      '&amp;',
    )
    .replaceAll(
      '<',
      '&lt;',
    )
    .replaceAll(
      '>',
      '&gt;',
    )
    .replaceAll(
      '"',
      '&quot;',
    )
    .replaceAll(
      "'",
      '&#39;',
    )
}

function makeIdempotencyKey(
  token,
) {
  const hash =
    createHash(
      'sha256',
    )
      .update(
        token,
        'utf8',
      )
      .digest(
        'hex',
      )

  return (
    `email-verification/${hash}`
  )
}

export function buildEmailVerificationUrl(
  token,
) {
  if (
    typeof token !==
      'string' ||
    token.length === 0
  ) {
    throw new TypeError(
      'Verification token is required.',
    )
  }

  const publicUrl =
    requireEnvironment(
      'EMAIL_VERIFICATION_PUBLIC_URL',
    )

  let url

  try {
    url =
      new URL(
        publicUrl,
      )
  } catch {
    throw new EmailDeliveryConfigurationError(
      'EMAIL_VERIFICATION_PUBLIC_URL must be a valid URL.',
    )
  }

  /*
   * Later this route will be handled by the
   * public verification page/API.
   */
  url.searchParams.set(
    'token',
    token,
  )

  return url.toString()
}

export async function sendVerificationEmail({
  email,
  username,
  token,
  expiresAt,
  fetchImpl =
    globalThis.fetch,
}) {
  if (
    typeof email !==
      'string' ||
    email.length === 0
  ) {
    throw new TypeError(
      'Recipient email is required.',
    )
  }

  if (
    typeof username !==
      'string' ||
    username.length === 0
  ) {
    throw new TypeError(
      'Username is required.',
    )
  }

  if (
    typeof fetchImpl !==
      'function'
  ) {
    throw new TypeError(
      'A fetch implementation is required.',
    )
  }

  const apiKey =
    requireEnvironment(
      'RESEND_API_KEY',
    )

  const from =
    requireEnvironment(
      'EMAIL_FROM',
    )

  const verificationUrl =
    buildEmailVerificationUrl(
      token,
    )

  const safeUsername =
    escapeHtml(
      username,
    )

  const safeUrl =
    escapeHtml(
      verificationUrl,
    )

  const expiryText =
    expiresAt
      ? new Date(
          expiresAt,
        ).toISOString()
      : null

  const text =
    [
      `Hello ${username},`,
      '',
      'Verify your LocalizationHub email address:',
      verificationUrl,
      '',
      expiryText
        ? `This link expires at ${expiryText}.`
        : 'This verification link will expire.',
      '',
      'If you did not create this account, you can ignore this email.',
    ].join(
      '\n',
    )

  const html =
    [
      '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">',
      '<h2>Verify your LocalizationHub email</h2>',
      `<p>Hello ${safeUsername},</p>`,
      '<p>Confirm your email address to finish setting up your LocalizationHub account.</p>',
      '<p>',
      `<a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px">Verify email</a>`,
      '</p>',
      expiryText
        ? `<p style="color:#6b7280;font-size:13px">This link expires at ${escapeHtml(expiryText)}.</p>`
        : '',
      '<p style="color:#6b7280;font-size:13px">If you did not create this account, you can ignore this email.</p>',
      '</div>',
    ].join(
      '',
    )

  const response =
    await fetchImpl(
      RESEND_API_URL,
      {
        method:
          'POST',

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          'Content-Type':
            'application/json',

          'Idempotency-Key':
            makeIdempotencyKey(
              token,
            ),
        },

        body:
          JSON.stringify({
            from,

            to: [
              email,
            ],

            subject:
              'Verify your LocalizationHub email',

            text,

            html,

            tags: [
              {
                name:
                  'category',

                value:
                  'email_verification',
              },
            ],
          }),
      },
    )

  let body =
    null

  try {
    body =
      await response.json()
  } catch {
    // Some provider failures may not return JSON.
  }

  if (
    !response.ok
  ) {
    throw new EmailDeliveryError(
      body?.message ||
        `Email provider returned HTTP ${response.status}.`,
      {
        statusCode:
          response.status,

        providerCode:
          body?.name ||
          body?.code ||
          null,
      },
    )
  }

  if (
    !body ||
    typeof body.id !==
      'string'
  ) {
    throw new EmailDeliveryError(
      'Email provider returned an invalid success response.',
      {
        statusCode:
          response.status,
      },
    )
  }

  return {
    provider:
      'resend',

    id:
      body.id,
  }
}
