import { youtubeMetadata } from './youtube.mjs'
import { spotifyMetadata } from './spotify.mjs'
import { validateArtworkBuffer } from '../radio.mjs'

const PROVIDERS = new Map([
  ['youtube', youtubeMetadata],
  ['spotify', spotifyMetadata],
])

export function parseRadioProviderUrl(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('A provider link is required.')
  let url
  try { url = new URL(input.trim()) } catch { throw new Error('Enter a valid Spotify or YouTube link.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Provider links must use HTTPS without credentials or custom ports.')
  const host = url.hostname.toLowerCase()
  if (host === 'open.spotify.com' && /^\/track\/[A-Za-z0-9]+$/u.test(url.pathname)) return { provider: 'spotify', url: url.toString() }
  if (host === 'www.youtube.com' && url.pathname === '/watch' && url.searchParams.get('v') && /^[A-Za-z0-9_-]{6,20}$/u.test(url.searchParams.get('v'))) return { provider: 'youtube', url: url.toString() }
  if (host === 'youtu.be' && /^\/[A-Za-z0-9_-]{6,20}$/u.test(url.pathname)) return { provider: 'youtube', url: url.toString() }
  throw new Error('Only official Spotify track and YouTube video links are supported.')
}

export async function resolveRadioMetadata(input, options = {}) {
  const parsed = parseRadioProviderUrl(input)
  return PROVIDERS.get(parsed.provider)(parsed.url, options)
}

export async function fetchApprovedRadioArtwork(input, options = {}) {
  const parsed = new URL(input)
  const host = parsed.hostname.toLowerCase()
  const approved = host === 'i.scdn.co' || host === 'image-cdn-ak.spotifycdn.com' || host === 'i.ytimg.com' || host === 'img.youtube.com'
  if (parsed.protocol !== 'https:' || !approved || parsed.username || parsed.password || parsed.port) throw new Error('Artwork host is not approved.')
  const timeoutMs = Math.min(Math.max(Number(options.timeoutMs) || 8000, 1000), 15000)
  const fetchImpl = options.fetchImpl || fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(parsed, { redirect: 'error', signal: controller.signal, headers: { Accept: 'image/jpeg,image/png,image/webp' } })
    if (!response.ok) throw new Error('Artwork could not be retrieved from the provider.')
    const length = Number(response.headers.get('content-length') || 0)
    if (length > 5 * 1024 * 1024) throw new Error('Artwork exceeds the 5 MB limit.')
    const bytes = Buffer.from(await response.arrayBuffer())
    const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
    validateArtworkBuffer(bytes, mime)
    return { data: bytes, mime }
  } finally {
    clearTimeout(timer)
  }
}
