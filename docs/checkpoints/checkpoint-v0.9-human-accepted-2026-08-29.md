# LocalizationHub v0.9 Human Acceptance Checkpoint

Date: 2026-08-29  
Branch: `feature/v0.9-arabic-ui`  
Accepted HEAD: `e6f2b7c10271ca1deb1b41bddc2789a39c8d245c`  
Stable release baseline: `v0.8.0` (`0cc482571686bc5fcf50710ca9aa360f87e2f59a`)

## Human acceptance

The current v0.9 product state was manually reviewed and accepted (“all good”).
The accepted scope is:

- Engine-aware Token Profiles: Auto, Generic, Godot, Unreal Engine, and Unity.
- Auto engine detection, confidence/fallback behavior, manual overrides, and
  mismatch warnings.
- Shared Desktop/Web token behavior and Project V3 compatibility.
- English UI, Arabic UI, Arabic RTL, language separation, and content-direction
  isolation.
- Public website, Web App, Workspace, Game Text Extraction, Admin, and LH Radio
  localization.
- Radio ingestion performance behavior and the bilingual Playwright isolation
  fixes.

## Feature freeze

v0.9 feature freeze is active. No new engines, locales, reinjection, round-trip
support, Radio features, integrations, redesigns, or speculative polish are
part of this checkpoint. Only regression, security, release-compatibility,
configuration, packaging, copy, accessibility, or responsive fixes remain
allowed.

## Verified test state

The isolated full Playwright suite completed twice with:

- 865 passed
- 105 skipped (existing intentional coverage skips)
- 0 failed

The test server does not load personal `.env.local` data. Admin, Radio, and
Cloud flows use synthetic credentials, fixtures, and route mocks.

## Known non-blocking limitations

- The local collaboration server may log harmless `DATABASE_URL is not
  configured` messages for incidental unmocked Radio requests; tests do not
  depend on that database or its data.
- Desktop/Tauri visual review is represented by production build, Rust checks,
  and shared-source coverage; browser visual review covers the web surfaces.
- Version metadata remains v0.8 until the separate release-preparation step.

This is a human-acceptance record only. It does not merge `main`, release v0.9,
or create a release-candidate tag.
