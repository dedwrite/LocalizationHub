import { randomUUID } from 'node:crypto'
import { getDatabasePool } from './database.mjs'

/*
 * Native first-party LH Radio library.
 *
 * Storage architecture: metadata lives in `radio_tracks`; audio and artwork
 * binaries live in separate `radio_track_audio` / `radio_track_artwork` tables
 * (BYTEA). This keeps the metadata list query small and lets a future object
 * storage migration replace only the binary tables without changing the public
 * API contract. For the small curated library this avoids any manual file
 * copying after deploy — everything persists in PostgreSQL.
 */

export class RadioValidationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'RadioValidationError'
    this.code = code
  }
}

export const MP3_MAX_BYTES = 25 * 1024 * 1024
export const ARTWORK_MAX_BYTES = 5 * 1024 * 1024
export const MAX_TITLE_LENGTH = 200
export const MAX_ARTIST_LENGTH = 200
export const MAX_ALBUM_LENGTH = 200

const ARTWORK_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function databaseNumber(value, field, { nullable = false } = {}) {
  if (value == null) {
    if (nullable) return null
    throw new Error(`Radio database field ${field} is missing.`)
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`Radio database field ${field} is not numeric.`)
  }
  const normalized = Number(value)
  if (!Number.isFinite(normalized)) {
    throw new Error(`Radio database field ${field} is not numeric.`)
  }
  return normalized
}

function cleanText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RadioValidationError('invalid-metadata', `${field} is required.`)
  }
  return value.trim()
}

export function validateTrackMetadata(input) {
  const title = cleanText(input?.title, 'Title')
  const artist = cleanText(input?.artist, 'Artist')
  if (title.length > MAX_TITLE_LENGTH) throw new RadioValidationError('invalid-metadata', 'Title is too long.')
  if (artist.length > MAX_ARTIST_LENGTH) throw new RadioValidationError('invalid-metadata', 'Artist is too long.')

  let album = null
  if (input?.album != null && String(input.album).trim() !== '') {
    album = String(input.album).trim()
    if (album.length > MAX_ALBUM_LENGTH) throw new RadioValidationError('invalid-metadata', 'Album is too long.')
  }

  const position = Number(input?.position)
  if (!Number.isInteger(position) || position < 0 || position > 1_000_000) {
    throw new RadioValidationError('invalid-metadata', 'Order must be a non-negative integer.')
  }

  const published = input?.published === true

  return { title, artist, album, position, published }
}

export function validateAudioBuffer(buffer, mime) {
  if (!Buffer.isBuffer(buffer)) throw new RadioValidationError('invalid-audio', 'Audio is required.')
  if (mime !== 'audio/mpeg' && mime !== 'audio/mp3') {
    throw new RadioValidationError('invalid-audio', 'Audio must be an MP3 file.')
  }
  if (buffer.length === 0) throw new RadioValidationError('invalid-audio', 'Audio is empty.')
  if (buffer.length > MP3_MAX_BYTES) throw new RadioValidationError('audio-too-large', `Audio exceeds the ${MP3_MAX_BYTES / (1024 * 1024)} MB limit.`)
  if (!looksLikeMp3(buffer)) throw new RadioValidationError('invalid-audio', 'Audio file signature is not a valid MP3.')
  return buffer
}

export function validateArtworkBuffer(buffer, mime) {
  if (!Buffer.isBuffer(buffer)) throw new RadioValidationError('invalid-artwork', 'Artwork is required.')
  if (!ARTWORK_MIMES.has(mime)) {
    throw new RadioValidationError('invalid-artwork', 'Artwork must be a JPEG, PNG, or WebP image.')
  }
  if (buffer.length === 0) throw new RadioValidationError('invalid-artwork', 'Artwork is empty.')
  if (buffer.length > ARTWORK_MAX_BYTES) throw new RadioValidationError('artwork-too-large', `Artwork exceeds the ${ARTWORK_MAX_BYTES / (1024 * 1024)} MB limit.`)
  if (!looksLikeImage(buffer, mime)) throw new RadioValidationError('invalid-artwork', 'Artwork file signature does not match its type.')
  return buffer
}

function looksLikeMp3(buffer) {
  // ID3v2 tag, or an MPEG audio frame sync (11-bit: 0xFF followed by 0xE0..0xFF).
  if (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true
  return buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0
}

function looksLikeImage(buffer, mime) {
  if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mime === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mime === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  return false
}

// ---- Admin data access ----

export async function listRadioTracks({ includeUnpublished = true } = {}) {
  const rows = await getDatabasePool().query(
    `SELECT id, title, artist, album, position, published, audio_mime, audio_size_bytes,
            artwork_mime, artwork_size_bytes, duration_seconds, created_at, updated_at
     FROM radio_tracks
     ORDER BY position ASC, created_at ASC`,
  )
  return rows.rows.map(serializeTrack)
}

export async function listPublishedRadioTracks() {
  const rows = await getDatabasePool().query(
    `SELECT id, title, artist, album, position, duration_seconds, artwork_mime
     FROM radio_tracks
     WHERE published = TRUE AND audio_size_bytes > 0
     ORDER BY position ASC, created_at ASC`,
  )
  return rows.rows.map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album ?? null,
    position: databaseNumber(row.position, 'position'),
    durationSeconds: databaseNumber(row.duration_seconds, 'duration_seconds', { nullable: true }),
    artworkUrl: `/api/radio/tracks/${row.id}/artwork`,
    audioUrl: `/api/radio/tracks/${row.id}/audio`,
  }))
}

export async function getRadioTrack(trackId) {
  const rows = await getDatabasePool().query(
    `SELECT id, title, artist, album, position, published, audio_mime, audio_size_bytes,
            artwork_mime, artwork_size_bytes, duration_seconds, created_at, updated_at
     FROM radio_tracks WHERE id = $1`,
    [trackId],
  )
  return rows.rows[0] ? serializeTrack(rows.rows[0]) : null
}

export async function createRadioTrack(metadata) {
  const id = randomUUID()
  await getDatabasePool().query(
    `INSERT INTO radio_tracks (id, title, artist, album, position, published)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, metadata.title, metadata.artist, metadata.album, metadata.position, metadata.published],
  )
  return getRadioTrack(id)
}

export async function updateRadioTrack(trackId, metadata) {
  const result = await getDatabasePool().query(
    `UPDATE radio_tracks
     SET title = $2, artist = $3, album = $4, position = $5, published = $6, updated_at = NOW()
     WHERE id = $1`,
    [trackId, metadata.title, metadata.artist, metadata.album, metadata.position, metadata.published],
  )
  if (!result.rowCount) return null
  return getRadioTrack(trackId)
}

export async function setRadioTrackAudio(trackId, buffer, mime) {
  validateAudioBuffer(buffer, mime)
  const result = await getDatabasePool().query(
    `INSERT INTO radio_track_audio (track_id, data, mime, size_bytes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (track_id) DO UPDATE SET data = EXCLUDED.data, mime = EXCLUDED.mime, size_bytes = EXCLUDED.size_bytes`,
    [trackId, buffer, mime === 'audio/mp3' ? 'audio/mpeg' : mime, buffer.length],
  )
  await getDatabasePool().query(
    `UPDATE radio_tracks SET audio_mime = $2, audio_size_bytes = $3, updated_at = NOW() WHERE id = $1`,
    [trackId, mime === 'audio/mp3' ? 'audio/mpeg' : mime, buffer.length],
  )
  return getRadioTrack(trackId)
}

export async function setRadioTrackArtwork(trackId, buffer, mime) {
  validateArtworkBuffer(buffer, mime)
  await getDatabasePool().query(
    `INSERT INTO radio_track_artwork (track_id, data, mime, size_bytes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (track_id) DO UPDATE SET data = EXCLUDED.data, mime = EXCLUDED.mime, size_bytes = EXCLUDED.size_bytes`,
    [trackId, buffer, mime, buffer.length],
  )
  await getDatabasePool().query(
    `UPDATE radio_tracks SET artwork_mime = $2, artwork_size_bytes = $3, updated_at = NOW() WHERE id = $1`,
    [trackId, mime, buffer.length],
  )
  return getRadioTrack(trackId)
}

export async function reorderRadioTracks(orderedIds) {
  if (!Array.isArray(orderedIds)) throw new RadioValidationError('invalid-metadata', 'Ordered track IDs are required.')
  const client = await getDatabasePool().connect()
  try {
    await client.query('BEGIN')
    for (let index = 0; index < orderedIds.length; index += 1) {
      const id = orderedIds[index]
      if (typeof id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(id)) {
        throw new RadioValidationError('invalid-metadata', 'Invalid track ID in reorder list.')
      }
      await client.query('UPDATE radio_tracks SET position = $2, updated_at = NOW() WHERE id = $1', [id, index])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function deleteRadioTrack(trackId) {
  const database = getDatabasePool()
  const client = await database.connect()
  try {
    await client.query('BEGIN')
    const track = await client.query('SELECT id, title FROM radio_tracks WHERE id = $1', [trackId])
    if (!track.rowCount) {
      await client.query('ROLLBACK')
      return null
    }
    await client.query('DELETE FROM radio_track_audio WHERE track_id = $1', [trackId])
    await client.query('DELETE FROM radio_track_artwork WHERE track_id = $1', [trackId])
    await client.query('DELETE FROM radio_tracks WHERE id = $1', [trackId])
    await client.query('COMMIT')
    return track.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getRadioMetrics() {
  const rows = await getDatabasePool().query(
    `SELECT
       COUNT(*)::int AS track_count,
       COUNT(*) FILTER (WHERE published = TRUE)::int AS published_count,
       COALESCE(SUM(audio_size_bytes), 0)::bigint AS total_audio_bytes,
       COALESCE(SUM(duration_seconds), 0)::double precision AS total_duration_seconds
     FROM radio_tracks`,
  )
  const row = rows.rows[0]
  return {
    track_count: databaseNumber(row?.track_count, 'track_count'),
    published_count: databaseNumber(row?.published_count, 'published_count'),
    total_audio_bytes: databaseNumber(row?.total_audio_bytes, 'total_audio_bytes'),
    total_duration_seconds: databaseNumber(row?.total_duration_seconds, 'total_duration_seconds'),
  }
}

// ---- Public binary access (published only) ----

export async function getPublishedRadioAudio(trackId) {
  const rows = await getDatabasePool().query(
    `SELECT a.data, a.mime, a.size_bytes, t.published
     FROM radio_track_audio a
     INNER JOIN radio_tracks t ON t.id = a.track_id
     WHERE a.track_id = $1`,
    [trackId],
  )
  const row = rows.rows[0]
  if (!row || !row.published) return null
  return { data: row.data, mime: row.mime, size: Number(row.size_bytes) }
}

export async function getPublishedRadioArtwork(trackId) {
  const rows = await getDatabasePool().query(
    `SELECT a.data, a.mime, a.size_bytes, t.published
     FROM radio_track_artwork a
     INNER JOIN radio_tracks t ON t.id = a.track_id
     WHERE a.track_id = $1`,
    [trackId],
  )
  const row = rows.rows[0]
  if (!row || !row.published) return null
  return { data: row.data, mime: row.mime, size: Number(row.size_bytes) }
}

function serializeTrack(row) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album ?? null,
    position: databaseNumber(row.position, 'position'),
    published: row.published,
    audioMime: row.audio_mime ?? null,
    audioSizeBytes: databaseNumber(row.audio_size_bytes ?? 0, 'audio_size_bytes'),
    artworkMime: row.artwork_mime ?? null,
    artworkSizeBytes: databaseNumber(row.artwork_size_bytes ?? 0, 'artwork_size_bytes'),
    durationSeconds: databaseNumber(row.duration_seconds, 'duration_seconds', { nullable: true }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
