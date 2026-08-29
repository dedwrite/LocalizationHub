import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeRadioAudio, chooseRadioMetadata, smartMatchRadioMetadata } from '../radio-analysis.mjs'
import { fetchApprovedRadioArtwork, parseRadioProviderUrl, resolveRadioMetadata } from '../radioMetadataProviders/index.mjs'
import { recommendRadioOptimization } from '../radio-optimization.mjs'

function syntheticMp3({ frameCount = 12_000, tagged = false } = {}) {
  const frame = Buffer.alloc(417)
  frame.set([0xff, 0xfb, 0x90, 0x64])
  const audio = Buffer.concat(Array.from({ length: frameCount }, () => frame))
  if (!tagged) return audio

  const textFrame = (id, value) => {
    const body = Buffer.concat([Buffer.from([3]), Buffer.from(value, 'utf8')])
    const header = Buffer.alloc(10)
    header.write(id, 0, 4, 'ascii')
    header.writeUInt32BE(body.length, 4)
    return Buffer.concat([header, body])
  }
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
  const pictureBody = Buffer.concat([
    Buffer.from([0]),
    Buffer.from('image/png\0', 'ascii'),
    Buffer.from([3, 0]),
    image,
  ])
  const pictureHeader = Buffer.alloc(10)
  pictureHeader.write('APIC', 0, 4, 'ascii')
  pictureHeader.writeUInt32BE(pictureBody.length, 4)
  const frames = Buffer.concat([
    textFrame('TIT2', 'Synthetic Track'),
    textFrame('TPE1', 'LocalizationHub Test'),
    textFrame('TALB', 'Performance Fixture'),
    textFrame('TRCK', '3'),
    textFrame('TYER', '2026'),
    pictureHeader,
    pictureBody,
  ])
  const tagHeader = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0])
  let size = frames.length
  for (let index = 9; index >= 6; index -= 1) {
    tagHeader[index] = size & 0x7f
    size >>= 7
  }
  return Buffer.concat([tagHeader, frames, audio])
}

describe('Radio Batch 2 audio analysis', () => {
  it('recovers conservative filename suggestions and safe unknown fields', async () => {
    const result = await analyzeRadioAudio(Buffer.concat([Buffer.from('ID3'), Buffer.alloc(16)]), { filename: 'Aurora Field - First Light.mp3' })
    assert.deepEqual(result.filenameSuggestion, { artist: 'Aurora Field', title: 'First Light', inferred: true })
    assert.equal(result.album, null)
    assert.equal(result.durationSeconds, null)
  })

  it('analyzes a representative synthetic MP3 with tags and embedded artwork', async () => {
    const fixture = syntheticMp3({ tagged: true })
    assert.ok(fixture.length > 4_500_000 && fixture.length < 5_500_000)
    const result = await analyzeRadioAudio(fixture, { filename: 'fallback.mp3' })
    assert.equal(result.title, 'Synthetic Track')
    assert.equal(result.artist, 'LocalizationHub Test')
    assert.equal(result.album, 'Performance Fixture')
    assert.equal(result.trackNumber, 3)
    assert.equal(result.year, 2026)
    assert.equal(result.codec, 'MPEG 1 Layer 3')
    assert.equal(result.bitrateKbps, 128)
    assert.equal(result.sampleRateHz, 44100)
    assert.equal(result.channels, 2)
    assert.ok(result.durationSeconds > 300)
    assert.equal(result.embeddedArtwork?.mime, 'image/png')
    assert.deepEqual(result.embeddedArtwork?.data, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]))
  })

  it('honors explicit, link, ID3, then filename metadata precedence', () => {
    assert.deepEqual(chooseRadioMetadata({ explicit: { title: 'Edited' }, link: { title: 'Link', artist: 'Provider' }, analysis: { title: 'ID3', artist: 'Tagged', album: 'Album', filenameSuggestion: { title: 'File', artist: 'File Artist' } } }), {
      title: 'Edited', artist: 'Provider', album: 'Album', inferred: { title: false, artist: false, album: false },
    })
  })

  it('returns explainable match levels and does not call Live/studio variants high confidence', () => {
    const result = smartMatchRadioMetadata({ title: 'Cemeteries', artist: 'Sodus', durationSeconds: 398 }, { title: 'Cemeteries (Live)', artist: 'Sodus', durationSeconds: 398 })
    assert.notEqual(result.level, 'High')
    assert.ok(result.evidence.length > 0)
  })
})

describe('Radio Batch 2 provider security and metadata', () => {
  it('accepts only official Spotify track and YouTube URLs', () => {
    assert.equal(parseRadioProviderUrl('https://open.spotify.com/track/abc123').provider, 'spotify')
    assert.equal(parseRadioProviderUrl('https://youtu.be/abc123').provider, 'youtube')
    assert.throws(() => parseRadioProviderUrl('http://localhost:8787/'), /official|HTTPS/i)
    assert.throws(() => parseRadioProviderUrl('https://open.spotify.com/track/abc123@127.0.0.1'), /official|HTTPS/i)
    assert.throws(() => parseRadioProviderUrl('https://example.com/track/abc123'), /official/i)
  })

  it('normalizes official oEmbed responses without requiring provider credentials', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ title: 'Cemeteries', author_name: 'Sodus', thumbnail_url: 'https://i.scdn.co/image/abc' }) })
    const result = await resolveRadioMetadata('https://open.spotify.com/track/abc123', { fetchImpl })
    assert.deepEqual({ provider: result.provider, title: result.title, artist: result.artist, album: result.album, artworkUrl: result.artworkUrl }, { provider: 'spotify', title: 'Cemeteries', artist: 'Sodus', album: null, artworkUrl: 'https://i.scdn.co/image/abc' })
  })

  it('rejects external artwork hosts and validates approved bytes', async () => {
    await assert.rejects(fetchApprovedRadioArtwork('https://example.com/cover.jpg', { fetchImpl: async () => ({}) }), /approved/u)
    await assert.rejects(fetchApprovedRadioArtwork('https://i.scdn.co/cover.jpg', { fetchImpl: async () => ({ ok: true, headers: new Headers({ 'content-type': 'image/jpeg' }), arrayBuffer: async () => new TextEncoder().encode('not image').buffer }) }), /signature/u)
  })
})

describe('Radio Batch 2 optimization recommendation', () => {
  it('keeps efficient and very short MP3s untouched', () => {
    assert.equal(recommendRadioOptimization({ bitrateKbps: 128, durationSeconds: 398, sizeBytes: 6_100_000 }).reason, 'already-efficient')
    assert.equal(recommendRadioOptimization({ bitrateKbps: 320, durationSeconds: 10, sizeBytes: 400_000 }).recommended, false)
  })

  it('recommends meaningful savings for large high-bitrate audio', () => {
    const result = recommendRadioOptimization({ bitrateKbps: 320, durationSeconds: 398, sizeBytes: 15_900_000 })
    assert.equal(result.recommended, true)
    assert.ok((result.estimatedSavingsPercent ?? 0) >= 15)
  })
})
