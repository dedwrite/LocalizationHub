# LocalizationHub v0.9 Release Candidate Checkpoint

Date: 2026-08-29  
Branch: `feature/v0.9-arabic-ui`  
Human-acceptance commit: `2e2536b8160dfba0cddbe496f24944e18ea96cdf`  
RC commit: the commit that adds this checkpoint document (recorded exactly in
the final report)  
Stable baseline: `v0.8.0` (`0cc482571686bc5fcf50710ca9aa360f87e2f59a`)

## Human acceptance and feature freeze

The current v0.9 feature set was manually accepted as “all good”. Accepted
scope includes Engine-Aware Token Profiles, Auto detection, Generic/Godot/
Unreal/Unity profiles, manual overrides and mismatch warnings, shared
Desktop/Web behavior, English and Arabic UI, Arabic RTL, content-direction
isolation, localized public/Web App/Workspace/Extraction/LH Radio/Admin
surfaces, the Radio ingestion performance fix, and bilingual Playwright
isolation.

The v0.9 feature freeze is active. No new engines, locales, reinjection,
round-trip support, Radio features, integrations, redesigns, or speculative
polish are included. Only regression, security, release-compatibility,
configuration, packaging, copy, accessibility, or responsive fixes remain
allowed.

## Token Profile and engine detection audit

Auto, Generic, Godot, Unreal Engine, Unity, and Unknown paths are covered by
the shared core. Extraction metadata takes precedence over structural and
content evidence; shared placeholders alone cannot create fake high confidence.
Unknown Auto state safely resolves to Generic. Manual profile selection and
mismatch warnings persist, malformed syntax is conservative, protected-token
validation remains source/translation aware, and old Project V3 data continues
to load. Desktop and Web consume the same semantic profile resolution.

## English/Arabic and RTL audit

The shared `packages/i18n` provider keeps English as the deterministic fresh
default and Arabic as an explicit persisted choice under
`localizationhub.ui-locale.v1`. Catalog parity remains complete at 891 keys:
no missing, duplicate, empty, interpolation-mismatch, untranslated, English
conflict, Arabic leakage, or unintended Arabic source literals were reported.

Arabic sets the RTL root while technical terms, paths, IDs, tokens, URLs, code,
and user content remain isolated. Source and translation direction remain
independent from UI language. Browser checks covered language switching,
reload persistence, RTL overflow, bidi content, accessibility labels, and
responsive states.

## Radio and Admin security audit

Radio ingestion keeps analysis separate from submit/save: metadata appears
during `Analyzing audio…`, timeout and retry preserve the selected file, stale
analysis cannot overwrite a replacement, and only the actual save shows
`Saving…`. Admin authorization remains on the reduced query path.

Admin library, upload, edit, publish/unpublish, reorder, delete, ID3,
embedded-artwork, metadata-only provider links, Smart Match, optimization,
structured MFA errors, existing enrollment, recent-TOTP requirements, and
session handling are covered with synthetic fixtures. Public audio/artwork
GET, HEAD, Range/206/416 behavior and unpublished protection are covered.

## Release-candidate gates

- Full Playwright run 1: 865 passed, 105 skipped, 0 failed.
- Full Playwright run 2: 865 passed, 105 skipped, 0 failed.
- Collaboration server: 140 passed.
- Combined Vitest (`packages/core/src`, `website/src`, `frontend/src`): 378
  passed across 54 files.
- Token-profile/extraction focused Vitest: 244 passed across 33 files.
- i18n parity/leakage audit and tests: 891 keys audited, 5 tests passed.
- Frontend and website production builds: passed.
- Frontend production verification: passed; no local URLs, paths, or secrets in
  built output.
- Rust: 13 tests passed; `cargo check` passed.
- Performance: 1 passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: passed.

No real `.env.local`, Admin key, TOTP secret, development database, Radio
content, copyrighted corpus, or binary fixture is required by the automated
suite. The test server deliberately uses synthetic route mocks and does not
re-enable `reuseExistingServer` contamination.

## History and production checks

`main` remains at the stable v0.8.0 commit. The existing checkpoint tags for
engine profiles, Arabic UI, and human acceptance remain unchanged. No force
push, merge, release tag, or deployment was performed. Product version
metadata remains `0.8.0` pending the separate release step.

## Known non-blocking limitations

- Incidental unmocked Radio requests can emit harmless `DATABASE_URL is not
  configured` messages in the isolated test server logs; no test depends on
  that database or its data.
- Desktop/Tauri visual review is represented by shared-source tests, production
  build, and Rust checks; browser visual review covers the web surfaces.

## Readiness

Release prep ready: **YES**. This checkpoint stops before merging main,
creating `v0.9.0`, publishing a release, or deploying.
