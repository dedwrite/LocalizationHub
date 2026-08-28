# LocalizationHub v0.7.0 — Release

## Status

v0.7.0 "Game Text Extraction" is released. It received human acceptance at the
candidate checkpoint and passed all release gates before publication.

## Accepted source checkpoint

- Branch: `feature/v0.7-game-text-extraction`
- Human-acceptance checkpoint: `checkpoint-v0.7-game-extraction-human-acceptance-candidate-2026-08-28`
- Accepted commit: `69cdca40306dab6b62f48eba55912b2b386fa11e`

## Release commit

- `chore(release): LocalizationHub v0.7.0` — the release-prep commit (version
  bump, public website metadata, release notes, changelog, README, and this
  checkpoint) tagged `v0.7.0`.

## Version

- Product version bumped to **0.7.0** across `package.json`, `frontend/package.json`,
  `website/package.json`, `packages/core/package.json`, `collaboration-server/package.json`,
  `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`,
  and `package-lock.json`.
- `@localizationhub/core` workspace dependency updated to `0.7.0`.
- Website release identity: **Game Text Extraction** (`website/src/config/site.ts`).

## Gates (all exit code 0)

| Gate | Result |
|---|---|
| `npm run build --workspace frontend` | 0 |
| `npm run build --workspace website` | 0 |
| `npx vitest run packages/core/src website/src` | 0 — 331 passed |
| `npm test --prefix collaboration-server` | 0 — 93 passed |
| `node --check collaboration-server/server.mjs` | 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 0 — 13 passed |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 0 |
| `npx playwright test` | 0 — 566 passed |
| `npm run test:performance` | 0 |
| `git diff --check` | 0 |
| `npm run verify:production --workspace frontend` | 0 |

## Release build artifacts

- Application: `src-tauri/target/release/localizationhub.exe` — 17,268,224 bytes
  (Windows version metadata: FileVersion 0.7.0, ProductVersion 0.7.0).
- Installer: `src-tauri/target/release/bundle/nsis/LocalizationHub_0.7.0_x64-setup.exe`
  — 5,669,469 bytes.

## Icon verification

- Source icon (`src-tauri/icons/icon.ico`) contains 32x32, 16x16, 24x24, 48x48,
  64x64, and 256x256 entries.
- The **generated** `localizationhub.exe` and the NSIS installer both extract a
  valid 32x32 associated icon.
- The Web App brand area now uses the canonical `localizationhub-logo.jpg`
  instead of the `LH` placeholder (app header and workspace toolbar).

## Production Cloud configuration

The release client embeds the public production endpoints (verified by
`validate-production-config.mjs` / `verify-production-build.mjs`):

- Cloud API: production `localizationhub.app` (no localhost/dev endpoint).
- Collaboration relay: production WebSocket endpoint.

No secrets, credentials, or API keys are embedded.

## Known limitations (unchanged)

- Newer Unreal UAsset versions are not covered by the verified external dumper.
- Unity assets with stripped type trees are inventoried but not fully extracted.
- Godot `OptimizedTranslation` keys are one-way hashes; values recover, keys need
  a full-project recovery pass.
- Some Ink choice forms are structurally ambiguous and are not auto-extracted.
- Encrypted archives require a valid user-provided AES key; keys are never
  brute-forced.

## Read-only guarantee

All extraction is read-only: source game files are never modified (verified by
source SHA-256 immutability checks on real archives).

## Public release tag

- `v0.7.0`

No credentials, private deployment values, database connection details, API
keys, or other operational secrets are included in this document.
