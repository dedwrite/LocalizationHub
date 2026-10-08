import test from 'node:test'
import assert from 'node:assert/strict'
import { sendVerificationEmail, sendAdminAccessCodeEmail, EmailDeliveryError } from '../email-delivery.mjs'

test('actual account and Admin senders deliver the shared product styling and plaintext', async t => {
  const names = ['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_VERIFICATION_PUBLIC_URL']
  const saved = names.map(name => process.env[name])
  t.after(() => names.forEach((name, index) => {
    if (saved[index] === undefined) delete process.env[name]
    else process.env[name] = saved[index]
  }))
  process.env.RESEND_API_KEY = 'synthetic-provider-key'
  process.env.EMAIL_FROM = 'LocalizationHub <test@example.invalid>'
  process.env.EMAIL_VERIFICATION_PUBLIC_URL = 'https://example.invalid/verify-email'
  const messages = []
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails')
    assert.equal(init.method, 'POST')
    assert.ok(init.headers['Idempotency-Key'])
    messages.push(JSON.parse(init.body))
    return {ok: true, status: 200, json: async () => ({id:'synthetic-message'})}
  }
  await sendVerificationEmail({email:'account@example.invalid', username:'مترجم <script>alert(1)</script>', token:'synthetic-token', expiresAt:'2030-01-01T00:00:00Z', fetchImpl})
  await sendAdminAccessCodeEmail({email:'admin@example.invalid', code:'123456', fetchImpl})
  for (const mail of messages) {
    assert.match(mail.html, /border-top:2px solid #bafa61/)
    assert.match(mail.html, /bgcolor="#050505"/)
    assert.match(mail.html, /role="presentation"/)
    assert.match(mail.html, /https:\/\/dedwrite.xyz\//)
    assert.ok(mail.text.length > 100)
    assert.doesNotMatch(mail.html, /<script>|#6d5dfc|#8e84ff/)
  }
  assert.match(messages[0].html, /&lt;script&gt;/)
  assert.match(messages[0].html, /dir="auto"/)
  assert.match(messages[0].html, /synthetic-token/)
  assert.match(messages[0].html, /UTC/)
  assert.match(messages[0].text, /synthetic-token/)
  assert.match(messages[1].text, /123456/)
  assert.match(messages[1].html, /five minutes/)
  const fail = async () => ({ok:false,status:503,json:async()=>({})})
  await assert.rejects(sendVerificationEmail({email:'account@example.invalid',username:'test',token:'synthetic-token',fetchImpl:fail}), EmailDeliveryError)
  await assert.rejects(sendAdminAccessCodeEmail({email:'admin@example.invalid',code:'123456',fetchImpl:fail}), EmailDeliveryError)
})
