# LocalizationHub v0.8 — LH Radio Smart Ingestion Checkpoint

Date: 2026-08-29  
Branch: `feature/v0.8-web-experience`  
Implementation commit: `04e26c1` (`feat(radio): add smart track ingestion`)  
Baseline accepted checkpoint: `checkpoint-v0.8-web-experience-human-accepted-2026-08-29`

## Scope

This checkpoint records LH Radio Batch 2: a review-first MP3 ingestion flow that
keeps the accepted Native LH Radio player, Admin MFA, public media behavior, and
the accepted Web App visual state intact. Visual Batch 2/3 work and the previous
checkpoint tags were not moved, rewritten, or merged.

## Smart ingestion

- MP3 selection is analyzed before save. ID3 title, artist, album, track number,
  year, embedded artwork, duration, codec, bitrate, sample rate, and channels
  are surfaced for review.
- Metadata precedence is explicit edits, provider metadata, ID3 metadata, then
  a conservative `Artist - Title` filename suggestion. Suggestions remain
  editable and inferred values are labeled.
- Embedded JPEG/PNG/WebP artwork is previewed and can be removed. Artwork is
  optional; a cover may be supplied manually or imported from an approved
  provider preview.
- The existing-track Analyze action backfills technical fields without deleting
  or replacing the existing enrollment, track, audio, or artwork records.
- Audio facts are stored in additive migration
  `collaboration-server/migrations/006_radio_audio_analysis.sql`. Existing data
  is preserved and no automatic re-enrollment/backfill is performed.

## Provider imports and security

Spotify and YouTube links are metadata-only suggestions; the operator must
attach an MP3 they have rights to stream. The implementation uses official
oEmbed endpoints without provider credentials:

- Spotify: title, `author_name` as artist, and approved artwork; album, duration,
  and year are unavailable from this endpoint and remain null.
- YouTube: title, thumbnail, and channel as an explicitly inferred artist
  display value; artist, album, duration, and year remain null.

Provider URL parsing requires HTTPS, official hosts, no credentials/custom
ports, and valid provider IDs. Requests use redirect rejection, bounded
timeouts, bounded metadata/artwork responses, approved CDN host allowlists, and
JPEG/PNG/WebP signature validation. No arbitrary URL fetch or local-network
fallback is permitted.

## Smart Match

When a provider link and MP3 are both present, Smart Match reports explainable
evidence: title (40 points), artist (35), and duration within two seconds (25).
Live/remix/acoustic/instrumental/demo/radio-edit/extended variants are not
promoted to High confidence solely by equal text. The UI keeps the result as a
review aid and never weakens the publish gate.

## Optional optimization

The server has a bounded `execFile`-based ffmpeg adapter with private temporary
files, argument arrays (no shell interpolation), cleanup in `finally`, and two
profiles: High Quality (192 kbps) and Storage Saver (128 kbps). Recommendations
are shown only when the measured source is at least 30 seconds, above 160 kbps,
and estimated savings are at least 15%; efficient files are explicitly marked
as already efficient. ffmpeg 8.1.1 is available in this local review
environment. Production/Render availability is runtime-checked and remains a
deployment limitation until the target image is verified.

## Admin UX and auditability

The Add Track dialog now leads with Upload MP3, clearly labels Link Import as
metadata-only, shows analysis and artwork proposals, exposes measured technical
fields, and keeps all metadata editable before save. Existing tracks offer
analysis rather than encouraging replacement. Metadata import, artwork import,
audio analysis, optimization, track updates, and publication changes emit safe
Admin audit actions without secrets, provider tokens, TOTP values, or binary
payloads.

## Public Radio compatibility

The accepted Native LH Radio player and public published-only catalog remain
unchanged. Existing direct media Range/HEAD coverage continues to pass, and the
additive technical columns do not alter public audio/artwork authorization.

## Files changed

- `collaboration-server/radio-analysis.mjs`
- `collaboration-server/radio-optimization.mjs`
- `collaboration-server/radioMetadataProviders/`
- `collaboration-server/migrations/006_radio_audio_analysis.sql`
- `collaboration-server/radio.mjs`
- `collaboration-server/server.mjs`
- `collaboration-server/tests/radio-batch2.test.mjs`
- `collaboration-server/package.json` and root `package-lock.json`
- `website/src/adminApi.ts`
- `website/src/AdminConsole.tsx`
- `website/src/admin-console.css`
- `tests/e2e/admin.spec.ts`

## Final gates

- `node --check collaboration-server/server.mjs` (pass)
- `npm test --prefix collaboration-server` — 137 passed
- `npm run build --workspace website` (pass)
- `npx vitest run website/src packages/core/src` — 349 passed across 50 files
- `npm run test:performance` — 1 passed
- Admin Playwright (`admin.spec.ts`) — 174 passed
- LH Radio Playwright (`lh-radio.spec.ts`, desktop) — 11 passed, 1 skipped
- `git diff --check` (pass)
- Full Playwright sweep: 807 passed, 105 skipped, with two pre-existing unrelated
  failures in `tests/e2e/web-save.spec.ts` (tablet functional draft updater) and
  `tests/e2e/safari-regression.spec.ts` (WebKit stale-token recovery). These are
  outside this Radio change and are retained as known repository gate issues.

## Known limitations

Provider oEmbed data is intentionally limited as described above; artwork and
metadata depend on provider availability/rate limits. ffmpeg must be present in
the deployment image for optimization. Existing audio is not automatically
re-encoded or backfilled; use the explicit Analyze action. New-track save still
uses the existing metadata-row then media-upload sequence with best-effort
cleanup if a later upload fails, so operators should review the resulting row
before publishing.

Local review URL: `http://127.0.0.1:8787/app/admin/radio`

This checkpoint is ready for human review. No release or next visual batch is
started by this document.
