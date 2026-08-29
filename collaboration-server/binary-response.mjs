/*
 * Parses a single HTTP byte range against a known body length.
 */
export function parseRangeHeader(rangeHeader, totalLength) {
  if (typeof rangeHeader !== 'string' || rangeHeader.length === 0) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) return { invalid: true }

  const rawStart = match[1]
  const rawEnd = match[2]
  if (rawStart === '' && rawEnd === '') return { invalid: true }

  let start
  let end
  if (rawStart === '') {
    const suffix = Number(rawEnd)
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true }
    start = Math.max(0, totalLength - suffix)
    end = totalLength - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? totalLength - 1 : Number(rawEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { invalid: true }
  }

  if (start < 0 || start >= totalLength || end < start) return { unsatisfiable: true }
  return { start, end: Math.min(end, totalLength - 1) }
}

/*
 * Sends GET or HEAD binary responses with matching headers and byte-range
 * semantics. HEAD intentionally sends no response body.
 */
export function serveBinary(response, buffer, mime, rangeHeader, requestMethod = 'GET') {
  const totalLength = buffer.length
  const headers = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=86400',
  }
  const range = parseRangeHeader(rangeHeader, totalLength)

  if (range?.invalid || range?.unsatisfiable) {
    response.writeHead(416, {
      ...headers,
      'Content-Range': `bytes */${totalLength}`,
      'Content-Length': 0,
    })
    response.end()
    return
  }

  if (range) {
    const slice = buffer.subarray(range.start, range.end + 1)
    response.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${range.start}-${range.end}/${totalLength}`,
      'Content-Length': slice.length,
    })
    response.end(requestMethod === 'HEAD' ? undefined : slice)
    return
  }

  response.writeHead(200, { ...headers, 'Content-Length': totalLength })
  response.end(requestMethod === 'HEAD' ? undefined : buffer)
}
