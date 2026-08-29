import { parseBuffer } from 'music-metadata'

const MAX_METADATA_TEXT = 200

function clean(value, limit = MAX_METADATA_TEXT) {
  if (typeof value !== 'string') return null
  const text = value.normalize('NFC').replace(/\s+/gu, ' ').trim()
  return text ? text.slice(0, limit) : null
}

function firstArtist(common) {
  if (Array.isArray(common?.artists) && common.artists.length > 0) return clean(common.artists.join(', '))
  return clean(common?.artist)
}

function filenameSuggestion(filename) {
  const base = clean(String(filename || '').replace(/\.[^.]+$/u, ''))
  if (!base) return { title: null, artist: null, inferred: false }
  const match = /^(.+?)\s[-–—]\s(.+)$/u.exec(base)
  if (!match) return { title: base, artist: null, inferred: true }
  return { artist: clean(match[1]), title: clean(match[2]), inferred: true }
}

function frameInfo(buffer) {
  const bitrates = {
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  }
  const sampleRates = { 0: [44100, 48000, 32000], 1: [22050, 24000, 16000], 2: [11025, 12000, 8000] }
  let start = buffer.subarray(0, 3).equals(Buffer.from('ID3')) && buffer.length >= 10
    ? 10 + ((buffer[6] & 0x7f) << 21) + ((buffer[7] & 0x7f) << 14) + ((buffer[8] & 0x7f) << 7) + (buffer[9] & 0x7f)
    : 0
  for (let offset = Math.max(0, start); offset + 4 <= buffer.length; offset += 1) {
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) continue
    const versionBits = (buffer[offset + 1] >> 3) & 3
    const layer = (buffer[offset + 1] >> 1) & 3
    const bitrateIndex = (buffer[offset + 2] >> 4) & 15
    const sampleIndex = (buffer[offset + 2] >> 2) & 3
    if (layer !== 1 || versionBits === 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) continue
    const version = versionBits === 3 ? 1 : 2
    const bitrate = bitrates[version][bitrateIndex] * 1000
    const sampleRate = sampleRates[versionBits === 3 ? 0 : versionBits === 2 ? 1 : 2][sampleIndex]
    const padding = (buffer[offset + 2] >> 1) & 1
    const frameLength = Math.floor((version === 1 ? 144 : 72) * bitrate / sampleRate) + padding
    if (frameLength < 4) continue
    const samples = version === 1 ? 1152 : 576
    return {
      codec: 'MP3',
      bitrate,
      sampleRate,
      channels: (buffer[offset + 3] >> 6) === 3 ? 1 : 2,
      duration: buffer.length > offset ? ((buffer.length - offset) / frameLength) * (samples / sampleRate) : null,
    }
  }
  return null
}

function pictureToResult(picture) {
  if (!picture?.data || !(Buffer.isBuffer(picture.data) || picture.data instanceof Uint8Array)) return null
  const mime = clean(picture.format, 80)?.toLowerCase()
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return null
  return { mime, data: Buffer.from(picture.data), description: clean(picture.description, 120) }
}

export async function analyzeRadioAudio(buffer, { filename = '' } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('Audio is required.')
  const fallback = frameInfo(buffer)
  let parsed = null
  try {
    parsed = await parseBuffer(buffer, { mimeType: 'audio/mpeg', size: buffer.length })
  } catch {
    // A minimal/partially tagged MP3 can still expose safe frame-level facts.
  }
  const common = parsed?.common ?? {}
  const format = parsed?.format ?? {}
  const embeddedArtwork = pictureToResult(common.picture?.[0])
  const suggestion = filenameSuggestion(filename)
  const durationSeconds = Number.isFinite(format.duration) ? format.duration : fallback?.duration ?? null
  const bitrate = Number.isFinite(format.bitrate) ? format.bitrate : fallback?.bitrate ?? null
  const sampleRate = Number.isFinite(format.sampleRate) ? format.sampleRate : fallback?.sampleRate ?? null
  const channels = Number.isInteger(format.numberOfChannels) ? format.numberOfChannels : fallback?.channels ?? null
  return {
    sizeBytes: buffer.length,
    durationSeconds: durationSeconds != null ? Number(durationSeconds.toFixed(3)) : null,
    codec: clean(format.codec || fallback?.codec, 40),
    bitrateKbps: bitrate != null ? Math.round(bitrate / 1000) : null,
    bitrateMode: clean(format.codecProfile || format.bitrateMode, 40),
    sampleRateHz: sampleRate != null ? Math.round(sampleRate) : null,
    channels,
    title: clean(common.title),
    artist: firstArtist(common),
    album: clean(common.album),
    trackNumber: common.track?.no != null ? Number(common.track.no) || null : null,
    year: common.year != null ? Number(common.year) || null : null,
    embeddedArtwork,
    filenameSuggestion: suggestion,
    source: parsed ? 'id3' : fallback ? 'frame-analysis' : 'unknown',
  }
}

export function chooseRadioMetadata({ explicit = {}, link = {}, analysis = {} } = {}) {
  const filename = analysis.filenameSuggestion ?? { title: null, artist: null, inferred: false }
  const pick = (key, ...values) => values.find((value) => typeof value === 'string' && value.trim())?.trim() || null
  return {
    title: pick('title', explicit.title, link.title, analysis.title, filename.title),
    artist: pick('artist', explicit.artist, link.artist, analysis.artist, filename.artist),
    album: pick('album', explicit.album, link.album, analysis.album),
    inferred: {
      title: !explicit.title && !link.title && !analysis.title && Boolean(filename.title),
      artist: !explicit.artist && !link.artist && !analysis.artist && Boolean(filename.artist),
      album: false,
    },
  }
}

export function smartMatchRadioMetadata(imported = {}, analysis = {}) {
  const evidence = []
  let points = 0
  const normalize = (value) => clean(value, 300)?.toLocaleLowerCase().replace(/[()[\]{}.,!?_:;]+/gu, ' ').replace(/\s+/gu, ' ').trim() || ''
  const title = normalize(imported.title)
  const id3Title = normalize(analysis.title)
  const artist = normalize(imported.artist)
  const id3Artist = normalize(analysis.artist)
  if (title && id3Title) {
    const liveMismatch = /\b(live|remix|acoustic|instrumental|demo|radio edit|extended mix)\b/iu.test(imported.title) !== /\b(live|remix|acoustic|instrumental|demo|radio edit|extended mix)\b/iu.test(analysis.title)
    if (title === id3Title && !liveMismatch) { points += 40; evidence.push({ state: 'pass', text: 'Title matches' }) }
    else evidence.push({ state: 'warn', text: 'Title needs review' })
  }
  if (artist && id3Artist) {
    if (artist === id3Artist) { points += 35; evidence.push({ state: 'pass', text: 'Artist matches' }) }
    else evidence.push({ state: 'warn', text: 'Artist needs review' })
  }
  if (Number.isFinite(imported.durationSeconds) && Number.isFinite(analysis.durationSeconds)) {
    const delta = Math.abs(imported.durationSeconds - analysis.durationSeconds)
    if (delta <= 2) { points += 25; evidence.push({ state: 'pass', text: `Duration within ${delta.toFixed(1)} seconds` }) }
    else evidence.push({ state: 'fail', text: 'Duration differs significantly' })
  }
  const level = points >= 85 ? 'High' : points >= 45 ? 'Medium' : points > 0 ? 'Low' : 'Insufficient evidence'
  return { level, score: points, evidence }
}
