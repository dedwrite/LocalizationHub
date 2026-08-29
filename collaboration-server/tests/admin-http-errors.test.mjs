import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AdminSecurityError } from '../admin.mjs'
import { formatAdminRequestError } from '../admin-http-errors.mjs'

describe('Admin HTTP error responses', () => {
  const cases = [
    ['totp-not-enrolled', 409],
    ['totp-invalid', 401],
    ['admin-security-unconfigured', 503],
    ['admin-email-required', 403],
    ['totp-already-enrolled', 409],
    ['admin-session-invalid', 401],
    ['admin-security-key-mismatch', 503],
  ]

  for (const [code, status] of cases) {
    it(`preserves ${code} as a structured response`, () => {
      const result = formatAdminRequestError(new AdminSecurityError(code, 'Safe Admin message.'))
      assert.equal(result.status, status)
      assert.deepEqual(result.body, { error: code, message: 'Safe Admin message.' })
      assert.equal(result.unexpected, false)
    })
  }

  it('keeps unexpected exception details out of the generic 500 response', () => {
    const result = formatAdminRequestError(new Error('secret-marker: should stay server-side'))
    assert.equal(result.status, 500)
    assert.deepEqual(result.body, { error: 'internal-error' })
    assert.equal(result.unexpected, true)
    assert.equal(JSON.stringify(result.body).includes('secret-marker'), false)
  })
})
