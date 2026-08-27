import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyCorsHeaders, getCorsAllowedOrigins } from '../cors.mjs'

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
  }
}

function requestWithOrigin(origin) {
  return { headers: origin === undefined ? {} : { origin } }
}

describe('CORS allowlist', () => {
  it('contains the official Tauri v2 desktop application origins', () => {
    const origins = getCorsAllowedOrigins()
    assert.equal(origins.has('http://tauri.localhost'), true)
    assert.equal(origins.has('tauri://localhost'), true)
    assert.equal(origins.has('https://tauri.localhost'), true)
  })

  it('contains the local development origins', () => {
    const origins = getCorsAllowedOrigins()
    assert.equal(origins.has('http://localhost:5173'), true)
    assert.equal(origins.has('http://127.0.0.1:5173'), true)
  })
})

describe('applyCorsHeaders', () => {
  it('allows the Windows Tauri desktop origin with correct headers', () => {
    const response = responseRecorder()
    const allowed = applyCorsHeaders(requestWithOrigin('http://tauri.localhost'), response)
    assert.equal(allowed, true)
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'http://tauri.localhost')
    assert.equal(response.headers['Vary'], 'Origin')
    assert.match(response.headers['Access-Control-Allow-Methods'], /POST/)
    assert.match(response.headers['Access-Control-Allow-Headers'], /Content-Type/)
    assert.match(response.headers['Access-Control-Allow-Headers'], /Authorization/)
  })

  it('allows the macOS Tauri desktop origin', () => {
    const response = responseRecorder()
    assert.equal(applyCorsHeaders(requestWithOrigin('tauri://localhost'), response), true)
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'tauri://localhost')
  })

  it('allows the local development origin', () => {
    const response = responseRecorder()
    assert.equal(applyCorsHeaders(requestWithOrigin('http://localhost:5173'), response), true)
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')
  })

  it('rejects an untrusted origin without emitting a permissive ACAO header', () => {
    const response = responseRecorder()
    const allowed = applyCorsHeaders(requestWithOrigin('https://evil.example'), response)
    assert.equal(allowed, false)
    assert.equal(response.headers['Access-Control-Allow-Origin'], undefined)
  })

  it('does not emit CORS headers when no Origin is present', () => {
    const response = responseRecorder()
    const allowed = applyCorsHeaders(requestWithOrigin(undefined), response)
    assert.equal(allowed, false)
    assert.equal(response.headers['Access-Control-Allow-Origin'], undefined)
  })

  it('never uses a wildcard allow-origin', () => {
    for (const origin of ['http://tauri.localhost', 'tauri://localhost', 'http://localhost:5173']) {
      const response = responseRecorder()
      applyCorsHeaders(requestWithOrigin(origin), response)
      assert.notEqual(response.headers['Access-Control-Allow-Origin'], '*')
    }
  })
})
