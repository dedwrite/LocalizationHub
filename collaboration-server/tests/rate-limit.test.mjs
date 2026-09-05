import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter } from '../rate-limit.mjs'

test('limits each client independently and resets exactly at the window boundary', () => {
  let time = 0
  const limiter = createRateLimiter({
    limit: 2,
    windowMs: 100,
    now: () => time,
  })
  assert.equal(limiter.allow('a'), true)
  assert.equal(limiter.allow('a'), true)
  assert.equal(limiter.allow('a'), false)
  assert.equal(limiter.allow('b'), true)
  time = 100
  assert.equal(limiter.allow('a'), true)
})

test('caps unique clients without evicting an active limit and frees expired clients', () => {
  let time = 0
  const limiter = createRateLimiter({
    limit: 1,
    windowMs: 100,
    maxClients: 2,
    now: () => time,
  })
  assert.equal(limiter.allow('a'), true)
  assert.equal(limiter.allow('b'), true)
  assert.equal(limiter.allow('c'), false)
  assert.equal(limiter.allow('a'), false)
  time = 100
  assert.equal(limiter.allow('c'), true)
})

test('rejects invalid settings', () => {
  assert.throws(
    () => createRateLimiter({ limit: 0, windowMs: 100 }),
    RangeError,
  )
  assert.throws(() => createRateLimiter({ limit: 1, windowMs: 0 }), RangeError)
})
