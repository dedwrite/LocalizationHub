# LocalizationHub v0.8.0 Release Checkpoint — 2026-08-29

This document records the final v0.8.0 release state after the approved
release-candidate checkpoint. It is a release record, not a new feature plan.

## Release identity

- Release: `LocalizationHub v0.8.0 — Web Experience Update`
- RC base: `080c7fd16570024bf1d8a4cc9df786b26c0277a5`
- Branch: `feature/v0.8-web-experience`
- Final release commit: the coherent release commit containing this checkpoint
  (the exact SHA is recorded in the final release report and tag target).
- Stable pre-release main: `604ed44ec1462c2ac8c704b55e58915d3d97dd3b`

## Release contents

v0.8.0 makes the accepted Web Experience update public while preserving the
v0.7 Game Text Extraction workflow. It includes the refreshed Landing and
Download surfaces, Cloud/Local Web App and Workspace polish, RTL/Arabic and
responsive improvements, dark-theme scrollbars, SPA navigation persistence, and
the first-party Native LH Radio player.

Native LH Radio is Admin-managed MP3 playback with a persistent custom player,
playlist/up-next, seek, volume, mute, previous/next, collapsed/expanded modes,
and rotating cover art. Smart ingestion reads ID3/audio properties, recovers
embedded artwork, provides metadata-only Spotify/YouTube suggestions and Smart
Match evidence, and optionally optimizes audio when ffmpeg is available. It
does not download provider audio or rip music.

## Version and packaging

All current package, workspace dependency, Cargo, Tauri, and website metadata is
`0.8.0`. Historical v0.7 release notes, checkpoints, and compatibility
references remain unchanged.

The Windows x64 release build completed successfully:

- EXE: `src-tauri/target/release/localizationhub.exe` (17,268,224 bytes)
- Installer: `src-tauri/target/release/bundle/nsis/LocalizationHub_0.8.0_x64-setup.exe`
  (5,666,444 bytes)
- Installer SHA-256:
  `2AD68ADFCE8843D6118E3EA44DABE4B231802E6E49A71F5CC2E1CEC18443D815`
- Windows file/product metadata: `0.8.0`
- Target: x64 NSIS; canonical LocalizationHub icon resources retained.

## Database and deployment

Migrations 005 and 006 are ordered, transactional, additive, and idempotent.
The local migration runner confirmed 001–006 already applied without changing
data. Production migration history and deployment completion are recorded after
the established deployment mechanism runs; no Radio data is seeded by release.

## Ffmpeg and provider status

The local review environment has working `ffmpeg` and `ffprobe`. The optional
optimizer uses bounded process execution, private temporary files, timeouts, and
cleanup. If the production image lacks either binary, optional optimization
degrades to an honest unavailable state while upload, analysis, metadata import,
Smart Match, and playback remain usable. Provider metadata requests are
strictly allowlisted, HTTPS-only, redirect-restricted, bounded, and metadata-
only.

## Final gates

All required release gates passed with zero failures:

- Frontend build: PASS
- Website build: PASS
- Vitest (`packages/core/src`, `website/src`): 350 passed / 0 failed
- Collaboration server: 137 passed / 0 failed
- Node syntax checks (server, Radio, analysis, optimization): PASS
- Tauri `cargo test`: 13 passed / 0 failed
- Tauri `cargo check`: PASS
- Frontend production verification: PASS
- Full Playwright: 809 passed, 105 skipped, 0 failed
- Performance: 1 passed / 0 failed
- `npm audit`: 0 vulnerabilities
- `git diff --check`: PASS

## Known limitations

- PostgreSQL-backed Radio media storage is sized for the current curated
  library; object storage is future scaling work.
- Optional optimization depends on ffmpeg/ffprobe availability in the target
  deployment image.
- Spotify/YouTube metadata suggestions depend on provider availability and
  rate limits and are not playback integrations.
- Some deep game binary formats remain partial or external-tool-required as
  documented in the v0.7 compatibility matrix.

## Release status

The release commit, merge, immutable `v0.8.0` tag, GitHub Release URL, and live
verification details are filled by the final release report after publication.
No v0.9 work is included.

