# Public readiness implementation plan

> Execute inline with executing-plans; use test-driven-development for behavior changes and one fresh whole-branch review.

**Goal:** Make the existing verified Windows release publicly discoverable while preparing the repository for external contributors.
**Architecture:** Centralize verified release metadata in the existing site configuration, use ordinary external download links without a runtime API dependency, preserve backend permissions and deployment configuration.
**Stack:** React/TypeScript, shared EN/AR catalogs, Tauri/Rust, Node/PostgreSQL, Vitest/Playwright, GitHub Actions.
**Spec:** Maintainer task attachment 884c067f-91a4-43d0-9833-9316643434c0; MIT explicitly approved in chat.

## Constraints

- No history rewriting, production secret changes, destructive data operations, or new binary release.
- Keep active AFTERHOURS deployment references intact; do not relocate without coordination.
- Preserve Arabic/RTL, the product identity and private Cloud authorization.
- Static verified release metadata is deliberate: predictable downloads without API/rate-limit failures.

## Review focus

- Anonymous GitHub download availability and checksum integrity.
- No private-tester copy remains in active EN/AR download paths.
- No CI access to production secrets or unsafe PR execution.
- External services remain intact; remove the unrelated file only after verified relocation.
- MIT does not override third-party asset licenses.

## Tasks and evidence ledger

- [ ] Security/baseline: repeat redacted scans, review auth boundaries, dependency advisories, service references, anonymous release download. Record actual baseline.
- [ ] Public download: failing public-link test, minimal page/config/catalog/metadata changes, EN/AR desktop/mobile regression and accessibility.
- [ ] Governance: MIT, contributing/security/conduct/templates, first-party metadata, accurate notices, README and maintainer/release guides.
- [ ] CI/cleanup: least-privilege tests/build/i18n/secret scan; improve ignore rules; preserve operational dependencies.
- [ ] Verify: npm ci/test/test:i18n/website:build, targeted Playwright, Rust checks where available, docs links, independent review.
- [ ] Delivery: focused commits, PR, deploy through existing main/Render flow only after checks, verify anonymous live downloads; no new installer/tag.

## Rulings

- Maintainer approved MIT. Existing commit author email remains unchanged by explicit prior decision.
- Plan execution is continuous per the master task; no planning-only stop.
- AFTERHOURS removal is safe: both live Render services now use dedwrite/afterhours, migration/cloudflare, with paths outside LocalizationHub.
- Baseline: clean be903f3; npm ci succeeded, 767 Vitest + 169 server tests passed and website built. npm reported 4 dependency advisories before patch updates.
- Public release verified anonymously: v0.9.10 installer and checksum HTTP 200; 5,597,930 bytes and matching published SHA-256.
- Targeted website acceptance: 94 Playwright cases passed after rebuilding. One first-run Arabic hydration timeout did not reproduce in isolated or full repeat runs; no i18n runtime change was made.
- Removed orphan request-access CSS when the existing dead-class regression correctly detected it. Brand name DEDTYPE added to the existing proper-noun audit exemptions, not translated.
- Independent reviewer found one lingering private-build panel label; RED test reproduced both languages, catalog corrected. Minor plan wording clarified here.
