# LocalizationHub v0.9.0 Release Checkpoint — 2026-08-29

This document records the final v0.9.0 release state after the approved
release-candidate checkpoint. It is a release record, not a new feature plan.

## Release identity

- Release: `LocalizationHub v0.9.0 — Arabic UI & Engine-Aware Tokens`
- RC base: `e0b3a7e4f1cae6e257e85a72b09652a772a47e57`
- Release-prep commit: `8f900b77207ae60fbc707cd630774565d26a002f`
- Branch: `feature/v0.9-arabic-ui`
- Main merge commit: `9fd4daa5cafdd9cd9e0d8ecd3191b320902e94a4`
- Release tag: `v0.9.0` (annotated tag object `68e4dd7fe99fe09016cda9856195acefcbab7f15`)
- Tag peeled target: `9fd4daa5cafdd9cd9e0d8ecd3191b320902e94a4`

## Release contents

v0.9.0 adds the accepted bilingual English/Arabic UI, persisted Arabic RTL
behavior, and engine-aware token profiles for Auto, Generic, Godot, Unreal
Engine, Unity, and Unknown paths. It preserves the accepted v0.8 Web App,
Workspace, Admin MFA, and Native LH Radio behavior.

## Version and packaging

Current package, workspace dependency, Cargo, Tauri, and website metadata is
`0.9.0`; historical release notes and checkpoints remain unchanged.

- EXE: `src-tauri/target/release/localizationhub.exe` (17,292,800 bytes)
- Installer: `src-tauri/target/release/bundle/nsis/LocalizationHub_0.9.0_x64-setup.exe` (5,695,242 bytes)
- Installer SHA-256: `13082380B8BB49EF8D4EA133310417E9F503DC8E9E2BE23120C7FD1CBA27ADE9`
- Windows file/product metadata: `0.9.0`
- Target: x64 NSIS

## GitHub Release and deployment

- GitHub Release: <https://github.com/dedwrite/LocalizationHub/releases/tag/v0.9.0>
- Assets: installer and `LocalizationHub_0.9.0_x64-setup.exe.sha256`
- GitHub installer digest: `sha256:13082380b8bb49ef8d4ea133310417e9f503dc8e9e2be23120c7fd1cba27ade9` (matches local SHA-256)
- Deployment: existing production deployment propagated from `main`.

## Final gates

- Full Playwright pre-merge run 1: 865 passed, 105 skipped, 0 failed.
- Full Playwright pre-merge run 2: 865 passed, 105 skipped, 0 failed.
- Full Playwright post-merge run: 865 passed, 105 skipped, 0 failed.
- Collaboration server: 140 passed, 0 failed.
- Combined Vitest (`packages/core/src`, `website/src`, `frontend/src`): 378
  passed across 54 files.
- i18n audit: 891 keys / 1,046 UI strings, 5 tests passed, no findings.
- Frontend and website production builds: passed.
- Frontend production verification: passed.
- Rust: 13 tests passed; `cargo check` passed.
- Performance: 1 passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: passed.
- Tauri production build: passed; version metadata verified as `0.9.0`.

## Production verification

- `https://localizationhub.app/` serves v0.9.0 with English selected by default.
- Arabic selector switches to `lang=ar`, `dir=rtl`, and persists after reload.
- `/download` links to v0.9.0 and names the 0.9.0 installer.
- `/app` and a production workspace open successfully; Token Profile control is
  present and no Workspace error boundary appears.
- Public Radio catalog returns 200; audio Range returns 206; audio and artwork
  HEAD return matching headers without a body.
- Unauthenticated Admin endpoint remains protected with HTTP 401.
- Production browser console showed no errors or warnings during verification.

## Known limitations

- Some deep game binary formats remain partial or external-tool-required as
  documented in `docs/dev/v0.7-engine-compatibility.md`.
- Radio media uses PostgreSQL-backed storage; object storage is future scaling
  work.
- Optional Radio audio optimization depends on ffmpeg/ffprobe availability.
- The public release currently packages Windows x64 only.

## Release status

v0.9.0 is released and published. No v0.9.1 or v0.10 work is included.
