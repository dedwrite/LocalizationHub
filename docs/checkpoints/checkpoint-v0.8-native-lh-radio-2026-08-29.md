# LocalizationHub v0.8 — Native LH Radio

## Status

The Spotify-based LH Radio concept was **human-rejected** (Spotify Embed only
offers preview playback for many visitors). This batch replaces it with a
**first-party, Admin-managed LH Radio** library. The previous
`checkpoint-v0.8-lh-radio-foundation-2026-08-29` remains the historical
Spotify-foundation checkpoint and is untouched.

## Branch & commits

- Branch: `feature/v0.8-web-experience`
- Starting commit: `07d5955245ed9c34032a02cd27e3817614e4be13`
- Final commit: see report (implementation + checkpoint)

## Storage architecture

Metadata lives in `radio_tracks` (small, indexable, no binary blobs); audio and
artwork binaries live in separate `radio_track_audio` / `radio_track_artwork`
tables as BYTEA. This keeps the metadata list query tiny and lets a future
object-storage migration replace only the binary tables without changing the
public API contract. For the small curated library this survives deploy/restart
with no manual file copying — everything persists in PostgreSQL.

DB migration: `collaboration-server/migrations/005_radio_library.sql`

## Spotify code removed

`website/src/lhRadio/spotifyPlaylist.ts`, `spotifyIframe.ts`, `useSpotifyIframe.ts`
deleted. The Spotify embed, iframe API loader, playlist constant, and Spotify
attribution/failure states are gone. The Privacy disclosure was rewritten from
the Spotify-specific wording to first-party wording. The global app shell, SPA
navigation persistence, and internal-navigation abstraction are preserved.

## Admin surface

- Route: `/app/admin/radio` (existing `Page` type + nav gained `radio`).
- `GET/POST /api/admin/radio/tracks`, `PATCH/DELETE /api/admin/radio/tracks/:id`,
  `PUT /api/admin/radio/tracks/:id/audio` + `/:id/artwork` (raw binary),
  `POST /api/admin/radio/tracks/reorder`, `GET /api/admin/radio/metrics`.
- Add/Edit modal (title, artist, album, order, published, audio, cover), reorder
  via keyboard-accessible ↑/↓, publish/unpublish, destructive delete with the
  existing confirmation + recent-TOTP convention, rights notice.
- Audit actions: `admin.radio.track_create/_update/_publish/_unpublish/_reorder/_delete`.
  Only track id/title/size/changed fields are logged — never raw bytes.

## Upload validation

- MP3 ≤ 25 MB, magic-byte checked (ID3 or MPEG frame sync), MIME `audio/mpeg`.
- Artwork ≤ 5 MB, JPEG/PNG/WebP only, magic-byte checked, no SVG/HTML.
- Server-generated UUIDs, parameterized SQL, strict size caps, no filename trust,
  no user-controlled filesystem paths.

## Public surface

- `GET /api/radio/tracks` → published metadata only (tiny; never fetches bytes).
- `GET /api/radio/tracks/:id/audio` → HTTP Range support (206/416/Accept-Ranges),
  `audio/mpeg`, published-only.
- `GET /api/radio/tracks/:id/artwork` → validated image with caching headers,
  published-only. An unpublished track is not retrievable by guessing its UUID.

## Native player

- Single global mount (`App → RoutedPage + LhRadio`), survives SPA navigation.
- Structural hidden `HTMLAudioElement` (`preload="metadata"`), custom controls.
- Play/pause, previous/next, automatic next on `ended`, seek, elapsed/duration,
  volume slider + mute (persisted), playlist/UP NEXT, track selection.
- Circular rotating cover disc (rotates only while playing, stops on pause),
  subtle center hub and restrained glow; reduced-motion respects `prefers-reduced-motion`.
- Collapsed capsule (cover, title, artist, progress, prev/play/next); expanded
  panel (large disc, seek, controls, volume, playlist). Mobile bottom bar +
  bottom sheet with `env(safe-area-inset-bottom)`, clears the app bottom nav.
- Empty catalog / catalog fetch failure hides the player cleanly.

## Known limitations

- `duration_seconds` is stored but not yet populated server-side (no MP3 parser
  in the dependency-light server); the player shows duration from the audio
  element instead. Public API returns `null` until an admin tool populates it.
- Playwright Chromium `phone-*` projects emulate a 393px screen against narrower
  viewports, so the fixed capsule sits below the visual viewport; capsule tests
  use keyboard activation to stay robust (real devices are unaffected).

## Gates (all exit code 0)

| Gate | Result |
|---|---|
| `npm run build --workspace website` | 0 |
| `npx vitest run website/src packages/core/src` | 0 — 349 passed |
| `npm test --prefix collaboration-server` | 0 — 107 passed |
| `node --check collaboration-server/server.mjs` | 0 |
| `npx playwright test` | 0 — 687 passed / 95 skipped |
| `npm run test:performance` | 0 |
| `git diff --check` | 0 |

## Tests added

- Server (`radio.test.mjs`): validation (MIME/magic/size), create/update/delete/
  reorder/upsert, published-only public access.
- Unit (`lhRadioState.test.ts`): reducer + volume/mute/open persistence.
- E2E (`lh-radio.spec.ts`, `admin.spec.ts` radio test): global player, catalog,
  play/pause, next/prev, seek/volume/mute, playlist, empty state, spinning disc,
  mobile safe-area, admin library.

## Next

Human visual review of the native LH Radio before any Landing/Web App visual
batch. Do not merge main; do not release v0.8.
