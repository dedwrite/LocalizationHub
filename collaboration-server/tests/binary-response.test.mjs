import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseRangeHeader, serveBinary } from '../binary-response.mjs'

class FakeResponse {
  status = null
  headers = null
  body = null
  writeHead(status, headers) {
    this.status = status
    this.headers = headers
  }
  end(body) {
    this.body = body
  }
}

describe('binary Range and HEAD responses', () => {
  const body = Buffer.from('0123456789', 'ascii')

  it('parses bounded and suffix byte ranges', () => {
    assert.deepEqual(parseRangeHeader('bytes=2-5', body.length), { start: 2, end: 5 })
    assert.deepEqual(parseRangeHeader('bytes=-3', body.length), { start: 7, end: 9 })
    assert.deepEqual(parseRangeHeader('bytes=20-30', body.length), { unsatisfiable: true })
  })

  it('serves a direct GET range with 206 and the selected bytes', () => {
    const response = new FakeResponse()
    serveBinary(response, body, 'audio/mpeg', 'bytes=2-5', 'GET')
    assert.equal(response.status, 206)
    assert.equal(response.headers['Accept-Ranges'], 'bytes')
    assert.equal(response.headers['Content-Range'], 'bytes 2-5/10')
    assert.equal(response.headers['Content-Length'], 4)
    assert.equal(response.body.toString('ascii'), '2345')
  })

  it('serves full HEAD headers without an audio response body', () => {
    const response = new FakeResponse()
    serveBinary(response, body, 'audio/mpeg', undefined, 'HEAD')
    assert.equal(response.status, 200)
    assert.equal(response.headers['Content-Type'], 'audio/mpeg')
    assert.equal(response.headers['Accept-Ranges'], 'bytes')
    assert.equal(response.headers['Content-Length'], 10)
    assert.equal(response.body, undefined)
  })

  it('serves ranged HEAD headers without an artwork response body', () => {
    const response = new FakeResponse()
    serveBinary(response, body, 'image/png', 'bytes=0-3', 'HEAD')
    assert.equal(response.status, 206)
    assert.equal(response.headers['Content-Type'], 'image/png')
    assert.equal(response.headers['Content-Range'], 'bytes 0-3/10')
    assert.equal(response.headers['Content-Length'], 4)
    assert.equal(response.body, undefined)
  })

  it('returns 416 with no body for an unsatisfiable range', () => {
    const response = new FakeResponse()
    serveBinary(response, body, 'audio/mpeg', 'bytes=100-200', 'GET')
    assert.equal(response.status, 416)
    assert.equal(response.headers['Content-Range'], 'bytes */10')
    assert.equal(response.body, undefined)
  })
})
