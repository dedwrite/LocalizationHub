-- Radio Batch 2: small, queryable audio facts for Admin review and metrics.
ALTER TABLE radio_tracks
  ADD COLUMN IF NOT EXISTS audio_codec TEXT,
  ADD COLUMN IF NOT EXISTS audio_bitrate_kbps INTEGER,
  ADD COLUMN IF NOT EXISTS audio_sample_rate_hz INTEGER,
  ADD COLUMN IF NOT EXISTS audio_channels INTEGER,
  ADD COLUMN IF NOT EXISTS audio_bitrate_mode TEXT,
  ADD COLUMN IF NOT EXISTS audio_optimized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS audio_encoding_profile TEXT;

ALTER TABLE radio_tracks
  DROP CONSTRAINT IF EXISTS radio_tracks_audio_bitrate_check,
  DROP CONSTRAINT IF EXISTS radio_tracks_audio_sample_rate_check,
  DROP CONSTRAINT IF EXISTS radio_tracks_audio_channels_check;

ALTER TABLE radio_tracks
  ADD CONSTRAINT radio_tracks_audio_bitrate_check CHECK (audio_bitrate_kbps IS NULL OR audio_bitrate_kbps > 0),
  ADD CONSTRAINT radio_tracks_audio_sample_rate_check CHECK (audio_sample_rate_hz IS NULL OR audio_sample_rate_hz > 0),
  ADD CONSTRAINT radio_tracks_audio_channels_check CHECK (audio_channels IS NULL OR audio_channels IN (1, 2));

