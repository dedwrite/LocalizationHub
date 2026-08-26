import assert from 'node:assert/strict'
import test from 'node:test'
import { generateTotpSecret, otpauthUri, totpCode, verifyTotp } from '../admin.mjs'

test('admin TOTP uses six digits and accepts only the current window', () => {
  const secret = generateTotpSecret()
  const timestamp = Date.UTC(2026, 7, 26, 12, 0, 0)
  const code = totpCode(secret, timestamp)
  assert.match(code, /^\d{6}$/)
  assert.equal(verifyTotp(secret, code, timestamp), true)
  assert.equal(verifyTotp(secret, '000000', timestamp), false)
  assert.match(otpauthUri(secret, 'operator'), /^otpauth:\/\/totp\/LocalizationHub:/)
})

test('admin TOTP secret is not an opaque database representation', () => {
  const secret = generateTotpSecret()
  assert.notEqual(secret, Buffer.from(secret, 'utf8').toString('base64'))
})
