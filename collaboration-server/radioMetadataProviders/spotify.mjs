function limited(value, max = 200) {
  return typeof value === 'string' && value.trim() ? value.normalize('NFC').trim().slice(0, max) : null
}

function approvedArtwork(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['i.scdn.co', 'image-cdn-ak.spotifycdn.com'].includes(url.hostname.toLowerCase()) ? url.toString() : null
  } catch { return null }
}

export async function spotifyMetadata(sourceUrl, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(sourceUrl)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 1000), 15000))
  try {
    const response = await fetchImpl(endpoint, { redirect: 'error', signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('Spotify metadata is unavailable for this link.')
    const contentLength = Number(response.headers?.get?.('content-length') || 0)
    if (contentLength > 256 * 1024) throw new Error('Spotify metadata response is too large.')
    const raw = typeof response.text === 'function' ? await response.text() : null
    if (raw != null && Buffer.byteLength(raw, 'utf8') > 256 * 1024) throw new Error('Spotify metadata response is too large.')
    const payload = raw != null ? JSON.parse(raw) : await response.json()
    return {
      provider: 'spotify', sourceUrl, externalId: new URL(sourceUrl).pathname.split('/').pop(),
      title: limited(payload.title), artist: limited(payload.author_name), album: null, artworkUrl: approvedArtwork(payload.thumbnail_url), durationSeconds: null, year: null,
      evidence: ['Spotify title, artist, and artwork metadata retrieved'],
    }
  } finally { clearTimeout(timer) }
}
