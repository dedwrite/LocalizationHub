import { AdminSecurityError } from './admin.mjs'
import { RadioValidationError } from './radio.mjs'

const ADMIN_STATUS_BY_CODE = new Map([
  ['admin-email-invalid', 401],
  ['totp-invalid', 401],
  ['admin-session-invalid', 401],
  ['admin-session-required', 401],
  ['admin-email-required', 403],
  ['admin-forbidden', 403],
  ['recent-totp-required', 403],
  ['totp-not-enrolled', 409],
  ['totp-already-enrolled', 409],
  ['admin-security-unconfigured', 503],
  ['admin-security-key-mismatch', 503],
])

export function formatAdminRequestError(error) {
  if (error instanceof AdminSecurityError) {
    return {
      status: ADMIN_STATUS_BY_CODE.get(error.code) ?? 403,
      body: { error: error.code, message: error.message },
      unexpected: false,
    }
  }

  if (error instanceof RadioValidationError) {
    return {
      status: 400,
      body: { error: error.code, message: error.message },
      unexpected: false,
    }
  }

  if (error?.code === 'payload-too-large') {
    return {
      status: 413,
      body: { error: 'payload-too-large', message: 'Upload exceeds the size limit.' },
      unexpected: false,
    }
  }

  return {
    status: 500,
    body: { error: 'internal-error' },
    unexpected: true,
  }
}
