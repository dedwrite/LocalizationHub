-- LH Radio — native first-party audio library.
--
-- Metadata lives in radio_tracks (small, indexable, no binary blobs).
-- Audio and artwork binaries are stored separately so list queries never
-- touch large bytea columns. A future move to object storage only changes the
-- binary tables; the metadata shape and public API contract stay stable.

CREATE TABLE IF NOT EXISTS radio_tracks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  position INTEGER NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  audio_mime TEXT,
  audio_size_bytes BIGINT NOT NULL DEFAULT 0,
  artwork_mime TEXT,
  artwork_size_bytes BIGINT NOT NULL DEFAULT 0,
  duration_seconds DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT radio_tracks_title_check CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT radio_tracks_artist_check CHECK (char_length(artist) BETWEEN 1 AND 200),
  CONSTRAINT radio_tracks_album_check CHECK (album IS NULL OR char_length(album) <= 200),
  CONSTRAINT radio_tracks_position_check CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS radio_tracks_published_position_index
  ON radio_tracks (published, position ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS radio_track_audio (
  track_id UUID PRIMARY KEY REFERENCES radio_tracks(id) ON DELETE CASCADE,
  data BYTEA NOT NULL,
  mime TEXT NOT NULL,
  size_bytes BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS radio_track_artwork (
  track_id UUID PRIMARY KEY REFERENCES radio_tracks(id) ON DELETE CASCADE,
  data BYTEA NOT NULL,
  mime TEXT NOT NULL,
  size_bytes BIGINT NOT NULL
);
