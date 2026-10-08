import test from 'node:test'
import assert from 'node:assert/strict'
import { adminCodeHtml, emailFrame } from '../email-template.mjs'

test('Admin mail retains one-time guidance, readable LTR code and product identity', () => {
  const html = adminCodeHtml('123456')
  assert.match(html, /dir="ltr"/)
  assert.match(html, /123456/)
  assert.match(html, /five minutes/)
  assert.match(html, /only be used once/)
  assert.match(html, /#bafa61/)
  assert.match(html, /role="presentation"/)
  assert.match(html, /https:\/\/dedwrite.xyz\//)
  assert.doesNotMatch(html, /<script|#6d5dfc|#8e84ff/)
})
test('Admin template rejects markup and malformed codes', () => {
  for (const code of ['<img>', '12345', '1234567', undefined]) assert.throws(() => adminCodeHtml(code), TypeError)
})
test('mail frame has a fluid narrow-screen table, not application CSS dependencies', () => {
  const html = emailFrame({title:'Verify your email', preview:'Confirm your account.', content:'<p>Message</p>'})
  assert.match(html, /max-width:560px/)
  assert.match(html, /width="100%"/)
  assert.doesNotMatch(html, /<link|javascript:/)
})
