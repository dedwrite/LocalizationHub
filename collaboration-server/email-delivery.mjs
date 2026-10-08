import {
  createHash,
} from 'node:crypto'
import { adminCodeHtml, emailFrame } from './email-template.mjs'

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

  const displayExpiryText =
    expiryText
      ? new Intl.DateTimeFormat(
          'en',
          {
            dateStyle:
              'medium',

            timeStyle:
              'short',

            timeZone:
              'UTC',
          },
        ).format(
          new Date(
            expiresAt,
          ),
        ) + ' UTC'
      : null

  const text =
    [
      'LocalizationHub',
      '',
      `Hello ${username},`,
      '',
      'Verify your email',
      '',
      'Confirm your email address to finish setting up and securing your LocalizationHub account.',
      '',
      verificationUrl,
      '',
      displayExpiryText
        ? `This verification link expires ${displayExpiryText}.`
        : 'This verification link will expire.',
      '',
      'If you did not create this account, you can safely ignore this email.',
      '',
      'A DEDWRITE Project',
    ].join(
      '\n',
    )

  const html = emailFrame({
    title: 'Verify your email',
    preview: 'Confirm your email address to finish setting up your LocalizationHub account.',
    content: [
      `<p style="font-size:15px;line-height:1.7;color:#c4ccc1">Hello <strong dir="auto" style="unicode-bidi:isolate;color:#f2f5f0">${safeUsername}</strong>,</p>`,
      '<p style="font-size:15px;line-height:1.7;color:#c4ccc1">Confirm your email address to finish setting up and securing your LocalizationHub account.</p>',
      '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td bgcolor="#bafa61" style="border-radius:6px">',
      `<a href="${safeUrl}" style="display:inline-block;padding:14px 22px;background:#bafa61;color:#050505;font-size:14px;font-weight:bold;text-decoration:none;border-radius:6px">Verify email</a></td></tr></table>`,
      displayExpiryText ? `<p style="font-size:12px;line-height:1.7;color:#a1aa9e">This verification link expires ${escapeHtml(displayExpiryText)}.</p>` : '',
      '<p style="font-size:12px;line-height:1.7;color:#a1aa9e">If the button does not work, copy and paste this link into your browser:</p>',
      `<p dir="ltr" style="word-break:break-all;overflow-wrap:anywhere;font-size:12px;line-height:1.7"><a href="${safeUrl}" style="color:#bafa61">${safeUrl}</a></p>`,
      '<p style="font-size:12px;line-height:1.7;color:#a1aa9e">If you did not create this account, you can safely ignore this email.</p>',
    ].join(''),
  })

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

export async function sendAdminAccessCodeEmail({
  email,
  code,
  fetchImpl = globalThis.fetch,
}) {
  if (!email || !/^\d{6}$/.test(code ?? '')) {
    throw new TypeError('Admin email recipient and code are required.')
  }
  const apiKey = requireEnvironment('RESEND_API_KEY')
  const from = requireEnvironment('EMAIL_FROM')
  const text = [
    'LocalizationHub Admin Access Code',
    '',
    `Your Admin Access Code is: ${code}`,
    '',
    'This code expires in approximately five minutes and can only be used once.',
    'If you did not request Admin access, you can safely ignore this email.',
  ].join('\n')
  const response = await fetchImpl(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `admin-access/${hashForEmail(code)}` },
    body: JSON.stringify({ from, to: [email], subject: 'LocalizationHub Admin Access Code', text, html: adminCodeHtml(code), tags: [{ name: 'category', value: 'admin_access' }] }),
  })
  if (!response.ok) throw new EmailDeliveryError(`Email provider returned HTTP ${response.status}.`, { statusCode: response.status })
  return { provider: 'resend' }
}

function hashForEmail(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
