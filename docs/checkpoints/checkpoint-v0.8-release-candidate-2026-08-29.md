# LocalizationHub v0.8 Release Candidate Audit — 2026-08-29

## Feature freeze

The v0.8 feature freeze is active. This checkpoint records release-candidate
audit readiness only; it does not bump the product version, merge `main`,
publish a release, deploy, or begin final release preparation.

- Branch: `feature/v0.8-web-experience`
- Audit starting commit: `dcaffb90b258d9eb56b9ecc12b29997c49d279a2`
- Base: `v0.7.0` / `main` at `604ed44ec1462c2ac8c704b55e58915d3d97dd3b`
- Final checkpoint commit: the commit that adds this document (the exact
  commit is reported with the RC tag).

## Regression closure

The two previously reported Playwright failures were reproduced under a
temporary `reuseExistingServer` setup and both passed independently and
repeatedly under the canonical configuration. The root cause was test
environment contamination: the temporary setup reused the live development
server/database, while the canonical `playwright.config.ts` intentionally
starts an isolated server (`reuseExistingServer: false`). No product assertion
was weakened, no retry or skip was added, and no production code change was
needed.

- Tablet functional draft updater: 3/3 independent passes.
- iPad stale-token recovery: 3/3 independent passes.
- Final canonical Playwright run: 809 passed, 105 skipped by project scope,
  0 failed.

## Radio and storage audit

Native LH Radio behavior remains intact across Admin, public catalog/media,
player, SPA persistence, smart ingestion, ID3 analysis, artwork, provider
metadata, Smart Match, and optional optimization. Numeric database values are
normalized at the server boundary. Public media supports GET, HEAD, byte-range
GET/HEAD (206), and unsatisfiable ranges (416), with unpublished media denied.

The migration runner sorts numbered SQL files, uses an advisory lock, and
applies each migration transactionally and idempotently. The current local
database reports migrations 001 through 006 applied in order; a repeat run was
already up to date. Migrations 005 and 006 preserve existing rows, use additive
nullable technical fields where appropriate, and keep metadata separate from
BYTEA media blobs. Audio uploads remain bounded at 25 MB and artwork at 5 MB.

The current local review database contains two published tracks with media.
No destructive migration experiment was run against it.

## FFmpeg status

Local `ffmpeg` and `ffprobe` are available and the adapter was checked with a
missing-binary probe. Optimization uses bounded `execFile` arguments, a
120-second timeout, private temporary files, and guaranteed cleanup. If the
deployment image lacks ffmpeg, normal MP3 upload/analysis remains available and
the optional optimization endpoint returns the safe `503 audio-optimization-unavailable`
response. The repository contains no deployment image/build manifest that can
prove Render binary availability; verifying that target image remains an
operational deployment step, not a reason to expose or require ffmpeg for add
track.

## Provider / SSRF audit

Spotify and YouTube integrations are metadata-only, explicit Admin actions.
URL parsing accepts only official provider hosts and supported resource forms;
provider requests use HTTPS, redirect rejection, timeouts, bounded response
handling, and safe text normalization. Artwork is fetched only from approved
provider CDN hosts and validated by MIME and file signature. No provider
credentials or audio downloads are used. Provider capabilities are documented
honestly: Spotify supplies title/author/artwork; YouTube supplies title,
thumbnail, and an explicitly inferred channel artist where available.

## Admin security

Super Admin restriction, verified email, TOTP enrollment/status/confirmation,
recent-TOTP destructive-action gates, session lifetime/logout, audit records,
and safe `ADMIN_SECURITY_KEY` mismatch handling remain covered by the existing
server and browser suites. Secret values, credentials, tokens, and TOTP
material are not included in this checkpoint.

## Web experience and extraction

Landing, Download, Privacy, Terms, FAQ, Web App, Cloud/Local Projects,
Workspace, RTL/Arabic presentation, inspector, focus mode, scrollbars, SPA
navigation, and Native LH Radio coexistence passed the responsive and
accessibility coverage. Current-facing copy still intentionally reports the
released `0.7.0`; historical v0.7 references are unchanged. Game extraction
coverage for Godot, Unreal, Unity, generic files, protected tokens, context,
locale logic, Project V3, and absolute-path privacy passed its existing unit and
integration suites.

Production desktop configuration verification passed with the committed public
Cloud and collaboration endpoints. Built output contained no runtime localhost
or test-database configuration in the production verification scan. During this
audit the website navigation fallback was changed from a literal development
localhost origin to the production origin, with a regression test; the rebuilt
website bundle is now clean of localhost/127.0.0.1/ws:// strings.

## Final gates

All required gates completed with zero failures:

| Gate | Result |
| --- | --- |
| Frontend build | PASS |
| Website build | PASS |
| Vitest (`packages/core/src`, `website/src`) | 350 passed / 0 failed |
| Collaboration-server tests | 137 passed / 0 failed |
| Node syntax checks (server, Radio, analysis, optimization) | PASS |
| Tauri `cargo test` | 13 passed, 0 failed (plus empty harness/doc suites) |
| Tauri `cargo check` | PASS |
| Frontend production verification | PASS |
| Full Playwright | 809 passed, 105 skipped, 0 failed |
| Performance test | 1 passed / 0 failed |
| Migration repeat/idempotence check | PASS |
| Extraction/token regression subset | 195 passed / 0 failed |
| Dependency audit (`npm audit --omit=dev --audit-level=high`) | 0 vulnerabilities |
| `git diff --check` | PASS |

## Known non-blocking limitations

- Render/deployment configuration is external to this repository; the target
  image still needs an operational ffmpeg/ffprobe availability check before
  enabling optional optimization in production.
- Provider metadata depends on third-party availability and rate limits.
- PostgreSQL BYTEA media storage is appropriate for the current curated library;
  object storage is future scaling work, outside this freeze.
- Assistive-technology testing beyond automated axe/keyboard coverage remains a
  human acceptance activity.

## Readiness

The v0.8 branch is release-candidate ready for approval. Full Playwright has
zero failures. Final release preparation (version bump, packaging metadata,
release notes, merge, publication, and deployment) has **not** begun.
