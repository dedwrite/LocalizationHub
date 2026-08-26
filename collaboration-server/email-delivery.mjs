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

  const html =
    [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<meta name="color-scheme" content="dark">',
      '<meta name="supported-color-schemes" content="dark">',
      '<title>Verify your LocalizationHub email</title>',
      '</head>',

      '<body style="margin:0;padding:0;background:#07090d;color:#f3f4f7;font-family:Arial,Helvetica,sans-serif;">',

      '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">',
      'Confirm your email address to finish setting up your LocalizationHub account.',
      '</div>',

      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#07090d" style="width:100%;background:#07090d;">',
      '<tr>',
      '<td align="center" style="padding:44px 16px;">',

      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:580px;background:#0e1117;border:1px solid #242936;border-radius:18px;">',

      '<tr>',
      '<td style="padding:36px 36px 0 36px;">',

      '<table role="presentation" cellspacing="0" cellpadding="0" border="0">',
      '<tr>',

      '<td valign="middle" style="padding-right:12px;">',
      '<img src="https://localizationhub.app/apple-touch-icon.png" alt="LocalizationHub" width="46" height="46" style="display:block;width:46px;height:46px;border:0;border-radius:12px;outline:none;text-decoration:none;">',
      '</td>',

      '<td valign="middle">',
      '<div style="color:#f5f6f8;font-size:18px;font-weight:700;line-height:1.2;">LocalizationHub</div>',
      '<div style="margin-top:4px;color:#7e8595;font-size:11px;letter-spacing:0.04em;">GAME LOCALIZATION WORKSPACE</div>',
      '</td>',

      '</tr>',
      '</table>',

      '</td>',
      '</tr>',

      '<tr>',
      '<td style="padding:32px 36px 36px 36px;">',

      '<h1 style="margin:0 0 14px 0;color:#f6f7f9;font-size:28px;line-height:1.2;font-weight:750;letter-spacing:-0.03em;">',
      'Verify your email',
      '</h1>',

      `<p style="margin:0 0 10px 0;color:#c8ccd5;font-size:15px;line-height:1.7;">Hello <strong style="color:#ffffff;">${safeUsername}</strong>,</p>`,

      '<p style="margin:0;color:#9da4b3;font-size:15px;line-height:1.7;">',
      'Confirm your email address to finish setting up and securing your LocalizationHub account.',
      '</p>',

      '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:26px;">',
      '<tr>',
      '<td bgcolor="#6d5dfc" style="border-radius:10px;">',
      `<a href="${safeUrl}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;background:#6d5dfc;">Verify Email</a>`,
      '</td>',
      '</tr>',
      '</table>',

      displayExpiryText
        ? `<div style="margin-top:22px;padding:11px 13px;background:#121620;border:1px solid #252b38;border-radius:9px;color:#7f8797;font-size:12px;line-height:1.6;">This verification link expires <strong style="color:#aeb4c0;">${escapeHtml(displayExpiryText)}</strong>.</div>`
        : '',

      '<div style="margin-top:26px;border-top:1px solid #202530;padding-top:22px;">',

      '<p style="margin:0 0 8px 0;color:#777f8f;font-size:12px;line-height:1.6;">',
      'If the button does not work, copy and paste this link into your browser:',
      '</p>',

      `<p style="margin:0;word-break:break-all;color:#8e84ff;font-size:11px;line-height:1.6;"><a href="${safeUrl}" style="color:#8e84ff;text-decoration:none;">${safeUrl}</a></p>`,

      '<p style="margin:18px 0 0 0;color:#6f7685;font-size:11px;line-height:1.6;">',
      'If you did not create this account, you can safely ignore this email.',
      '</p>',

      '</div>',

      '</td>',
      '</tr>',

      '<tr>',
      '<td align="center" style="padding:19px 24px;border-top:1px solid #202530;background:#0b0e14;border-radius:0 0 18px 18px;">',

      '<a href="https://dedwrite.xyz/" target="_blank" style="text-decoration:none;">',
      '<span style="color:#5f6675;font-size:9px;letter-spacing:0.18em;">A </span>',
      '<span style="color:#9ba1ad;font-size:10px;font-weight:800;letter-spacing:0.16em;">DEDWRITE</span>',
      '<span style="color:#5f6675;font-size:9px;letter-spacing:0.12em;"> PROJECT</span>',
      '</a>',

      '</td>',
      '</tr>',

      '</table>',

      '</td>',
      '</tr>',
      '</table>',

      '</body>',
      '</html>',
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
    body: JSON.stringify({ from, to: [email], subject: 'LocalizationHub Admin Access Code', text, html: `<p>LocalizationHub Admin Access Code</p><p><strong>${code}</strong></p><p>If you did not request Admin access, you can safely ignore this email.</p>`, tags: [{ name: 'category', value: 'admin_access' }] }),
  })
  if (!response.ok) throw new EmailDeliveryError(`Email provider returned HTTP ${response.status}.`, { statusCode: response.status })
  return { provider: 'resend' }
}

function hashForEmail(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
