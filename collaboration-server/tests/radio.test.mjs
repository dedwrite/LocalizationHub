import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { resetDatabasePoolForTests, setDatabasePoolForTests } from '../database.mjs'
import {
  ARTWORK_MAX_BYTES,
  MP3_MAX_BYTES,
  RadioValidationError,
  createRadioTrack,
  deleteRadioTrack,
  getPublishedRadioArtwork,
  getPublishedRadioAudio,
  getRadioMetrics,
  listRadioTracks,
  listPublishedRadioTracks,
  reorderRadioTracks,
  setRadioTrackArtwork,
  setRadioTrackAudio,
  updateRadioTrack,
  validateArtworkBuffer,
  validateAudioBuffer,
  validateTrackMetadata,
} from '../radio.mjs'

const TRACK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function rows(list) { return { rows: list, rowCount: list.length } }
function row(obj) { return rows([obj]) }
function empty() { return rows([]) }

class FakeClient {
  constructor(handlers = {}) {
    this.handlers = handlers
    this.calls = []
    this.released = false
  }
  async query(sql, params) {
    this.calls.push({ sql, params })
    if (/^(BEGIN|COMMIT|ROLLBACK)$/u.test(sql.trim())) return { rows: [], rowCount: 0 }
    for (const [needle, handler] of Object.entries(this.handlers)) {
      if (sql.includes(needle)) {
        const result = typeof handler === 'function' ? handler(sql, params) : handler
        if (result && result.error) throw result.error
        return result
      }
    }
    return empty()
  }
  release() { this.released = true }
}
function pool(client) { return { connect: async () => client, query: (...args) => client.query(...args) } }

const trackRow = {
  id: TRACK_ID, title: 'First Light', artist: 'Aurora Field', album: 'Dawn', position: 0,
  published: true, audio_mime: 'audio/mpeg', audio_size_bytes: 12345, artwork_mime: 'image/png',
  artwork_size_bytes: 678, duration_seconds: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}

afterEach(() => {
  resetDatabasePoolForTests()
})

describe('radio metadata validation', () => {
  it('accepts valid metadata and normalizes optional album', () => {
    const result = validateTrackMetadata({ title: ' First Light ', artist: 'Aurora', album: ' ', position: '2', published: false })
    assert.equal(result.title, 'First Light')
    assert.equal(result.artist, 'Aurora')
    assert.equal(result.album, null)
    assert.equal(result.position, 2)
    assert.equal(result.published, false)
  })

  it('rejects missing title/artist and invalid positions', () => {
    assert.throws(() => validateTrackMetadata({ title: '', artist: 'A' }), RadioValidationError)
    assert.throws(() => validateTrackMetadata({ title: 'T', artist: '' }), RadioValidationError)
    assert.throws(() => validateTrackMetadata({ title: 'T', artist: 'A', position: -1 }), RadioValidationError)
    assert.throws(() => validateTrackMetadata({ title: 'T', artist: 'A', position: 'NaN' }), RadioValidationError)
  })

  it('rejects oversized text fields', () => {
    assert.throws(() => validateTrackMetadata({ title: 'x'.repeat(201), artist: 'A' }), RadioValidationError)
    assert.throws(() => validateTrackMetadata({ title: 'T', artist: 'x'.repeat(201) }), RadioValidationError)
  })
})

describe('radio audio validation', () => {
  it('accepts an MP3 with an ID3 tag or an MPEG frame sync', () => {
    validateAudioBuffer(Buffer.concat([Buffer.from('ID3'), Buffer.alloc(16)]), 'audio/mpeg')
    validateAudioBuffer(Buffer.from([0xff, 0xfb, 0x90, 0x64]), 'audio/mpeg')
  })

  it('rejects non-MP3 signatures, wrong MIME, and oversized files', () => {
    assert.throws(() => validateAudioBuffer(Buffer.from('not an mp3'), 'audio/mpeg'), RadioValidationError)
    assert.throws(() => validateAudioBuffer(Buffer.from('ID3xx'), 'audio/ogg'), RadioValidationError)
    assert.throws(() => validateAudioBuffer(Buffer.alloc(MP3_MAX_BYTES + 1), 'audio/mpeg'), RadioValidationError)
  })
})

describe('radio artwork validation', () => {
  it('accepts JPEG, PNG, and WebP signatures', () => {
    validateArtworkBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')
    validateArtworkBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png')
    validateArtworkBuffer(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]), 'image/webp')
  })

  it('rejects SVG, HTML, mismatched MIME, and oversized files', () => {
    assert.throws(() => validateArtworkBuffer(Buffer.from('<svg></svg>'), 'image/svg+xml'), RadioValidationError)
    assert.throws(() => validateArtworkBuffer(Buffer.from('<script></script>'), 'image/png'), RadioValidationError)
    assert.throws(() => validateArtworkBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/jpeg'), RadioValidationError)
    assert.throws(() => validateArtworkBuffer(Buffer.alloc(ARTWORK_MAX_BYTES + 1), 'image/png'), RadioValidationError)
  })
})

describe('radio track data access', () => {
  it('normalizes zero-valued PostgreSQL metrics to JavaScript numbers', async () => {
    const client = new FakeClient({
      'COUNT(*)::int AS track_count': row({
        track_count: 0,
        published_count: 0,
        total_audio_bytes: '0',
        total_duration_seconds: '0',
      }),
    })
    setDatabasePoolForTests(pool(client))
    assert.deepEqual(await getRadioMetrics(), {
      track_count: 0,
      published_count: 0,
      total_audio_bytes: 0,
      total_duration_seconds: 0,
    })
  })

  it('normalizes numeric fields for a synthetic track with non-zero media sizes', async () => {
    const client = new FakeClient({
      'FROM radio_tracks': row({
        ...trackRow,
        position: '3',
        audio_size_bytes: '12345',
        artwork_size_bytes: '678',
        duration_seconds: '180.5',
      }),
    })
    setDatabasePoolForTests(pool(client))
    const tracks = await listRadioTracks()
    assert.deepEqual(
      {
        position: tracks[0].position,
        audioSizeBytes: tracks[0].audioSizeBytes,
        artworkSizeBytes: tracks[0].artworkSizeBytes,
        durationSeconds: tracks[0].durationSeconds,
      },
      { position: 3, audioSizeBytes: 12345, artworkSizeBytes: 678, durationSeconds: 180.5 },
    )
  })

  it('rejects malformed numeric database values instead of leaking them into the API', async () => {
    const client = new FakeClient({
      'COUNT(*)::int AS track_count': row({
        track_count: 0,
        published_count: 0,
        total_audio_bytes: 'not-a-number',
        total_duration_seconds: 0,
      }),
    })
    setDatabasePoolForTests(pool(client))
    await assert.rejects(getRadioMetrics(), /total_audio_bytes is not numeric/)
  })

  it('creates a track and returns its serialized form', async () => {
    const client = new FakeClient({
      'INSERT INTO radio_tracks': row(trackRow),
      'SELECT id, title, artist, album, position, published': row(trackRow),
    })
    setDatabasePoolForTests(pool(client))
    const track = await createRadioTrack({ title: 'First Light', artist: 'Aurora Field', album: 'Dawn', position: 0, published: true })
    assert.equal(track.title, 'First Light')
    assert.equal(track.position, 0)
  })

  it('lists only published tracks with media for the public catalog', async () => {
    const client = new FakeClient({
      'WHERE published = TRUE AND audio_size_bytes > 0': rows([
        { id: TRACK_ID, title: 'First Light', artist: 'Aurora Field', album: 'Dawn', position: 0, duration_seconds: 180, artwork_mime: 'image/png' },
      ]),
    })
    setDatabasePoolForTests(pool(client))
    const tracks = await listPublishedRadioTracks()
    assert.equal(tracks.length, 1)
    assert.equal(tracks[0].audioUrl, `/api/radio/tracks/${TRACK_ID}/audio`)
    assert.equal(tracks[0].artworkUrl, `/api/radio/tracks/${TRACK_ID}/artwork`)
    assert.equal(tracks[0].durationSeconds, 180)
  })

  it('updates metadata and replaces audio via upsert', async () => {
    const client = new FakeClient({
      'UPDATE radio_tracks': row(trackRow),
      'INSERT INTO radio_track_audio': empty(),
      'SELECT id, title, artist, album, position, published': row(trackRow),
    })
    setDatabasePoolForTests(pool(client))
    await setRadioTrackAudio(TRACK_ID, Buffer.from('ID3data'), 'audio/mpeg')
    assert.ok(client.calls.some((c) => c.sql.includes('INSERT INTO radio_track_audio')))
  })

  it('returns null when deleting a missing track', async () => {
    const client = new FakeClient({ 'SELECT id, title FROM radio_tracks': empty() })
    setDatabasePoolForTests(pool(client))
    assert.equal(await deleteRadioTrack(TRACK_ID), null)
  })

  it('reorders tracks inside a transaction', async () => {
    const client = new FakeClient({ 'UPDATE radio_tracks SET position': empty() })
    setDatabasePoolForTests(pool(client))
    await reorderRadioTracks(['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', TRACK_ID])
    const updateCalls = client.calls.filter((c) => c.sql.includes('UPDATE radio_tracks SET position'))
    assert.equal(updateCalls.length, 2)
    assert.ok(client.calls.some((c) => c.sql.trim() === 'BEGIN'))
    assert.ok(client.calls.some((c) => c.sql.trim() === 'COMMIT'))
  })

  it('does not return unpublished audio or artwork to the public', async () => {
    const client = new FakeClient({
      'FROM radio_track_audio a': row({ data: Buffer.from('ID3'), mime: 'audio/mpeg', size_bytes: 4, published: false }),
    })
    setDatabasePoolForTests(pool(client))
    assert.equal(await getPublishedRadioAudio(TRACK_ID), null)
  })

  it('returns published audio and artwork', async () => {
    const client = new FakeClient({
      'FROM radio_track_audio a': row({ data: Buffer.from('ID3'), mime: 'audio/mpeg', size_bytes: 4, published: true }),
      'FROM radio_track_artwork a': row({ data: Buffer.from([0xff, 0xd8, 0xff]), mime: 'image/jpeg', size_bytes: 3, published: true }),
    })
    setDatabasePoolForTests(pool(client))
    const audio = await getPublishedRadioAudio(TRACK_ID)
    assert.equal(audio.mime, 'audio/mpeg')
    const artwork = await getPublishedRadioArtwork(TRACK_ID)
    assert.equal(artwork.mime, 'image/jpeg')
  })
})
