# LocalizationHub v0.8 — Native LH Radio Human Acceptance

## Status

The first-party, Admin-managed Native LH Radio is **HUMAN ACCEPTED** on
`feature/v0.8-web-experience`. This checkpoint records the final behavior after
hands-on review and the two narrow defects found and fixed during that review.

The historical tag `checkpoint-v0.8-native-lh-radio-2026-08-29` remains at
`26fa84d` and is intentionally unchanged. It records the pre-human-review
implementation state.

## Accepted architecture

- Radio metadata and media remain first-party and Admin-managed.
- Metadata is stored in `radio_tracks`; audio and artwork bytes remain in their
  dedicated PostgreSQL tables.
- The native player remains mounted in the global application shell and keeps
  playback alive across Landing and Web App SPA navigation.
- No Spotify embed or Spotify dependency is present.
- The accepted player architecture, responsive behavior, and interaction model
  are not being redesigned by subsequent visual work.

## Human-verified behavior

The following behavior was manually exercised and accepted:

- Admin MP3 upload, artwork upload, and publish flow.
- Full-track playback from the first-party library.
- Collapsed and expanded player modes.
- Circular artwork disc and rotation while playing in both modes.
- Rotation stopping correctly on pause.
- Seeking, volume adjustment, and mute.
- Previous and next track controls.
- Playback persistence between public Landing and Web App routes during SPA
  navigation.
- Mobile behavior and coexistence with the surrounding application shell.

## Admin MFA defect found during review

Admin email verification succeeded, but TOTP confirmation failures were caught
by a broad Radio request boundary and rewritten as
`500 { error: "internal-error" }`. The same boundary also mislabeled Admin auth
failures as Radio failures.

Commit `6a92b61` preserves safe `AdminSecurityError` codes and appropriate 4xx
responses, narrows the Radio boundary, reports unexpected exceptions without
secret leakage, and makes the TOTP enrollment UI reflect whether an
Authenticator is already configured. Existing enrollment data was preserved;
MFA was not weakened or reset.

## PostgreSQL numeric-contract defect found during review

With an empty library, PostgreSQL returned the `BIGINT` aggregate
`total_audio_bytes` as the string `"0"`. The Admin UI passed it to
`formatBytes()`, whose numeric formatter called `.toFixed()` and crashed the
entire view after loading.

Commit `a496496` normalizes all Radio metric and track numeric fields at the
server boundary and validates them again at the typed client boundary. It also
keeps the Radio view mounted with an inline error/retry state when either Radio
API fails or returns a malformed numeric payload. The real zero-track state was
manually reverified in the browser.

## HEAD and Range correction

Commit `a496496` also makes public audio and artwork endpoints accept `HEAD` and
return the same relevant MIME, cache, content-length, and range headers as
`GET`, without a response body. Direct coverage includes full and ranged HEAD,
ranged GET (`206`), and unsatisfiable ranges (`416`).

## Known limitation

`duration_seconds` is not populated server-side. The native audio element still
provides runtime duration for playback, while stored/API duration remains
`null` until a future, explicitly scoped metadata implementation is added.

## Branch and commits

- Branch: `feature/v0.8-web-experience`
- Historical pre-review checkpoint commit: `26fa84d`
- Admin MFA fix: `6a92b61`
- Radio numeric-contract, inline recovery, and HEAD/Range fix: `a496496`
- Accepted implementation tip before this document: `a496496eeec9cf176acbf3b3c4245fd39e8a1bb2`

## Gates applicable to the accepted state

The native implementation checkpoint passed the complete repository gate,
including 687 Playwright tests (95 skipped). After the human-review fixes, the
following focused gates were rerun with zero failures:

| Gate | Result |
|---|---|
| `node --check collaboration-server/server.mjs` | passed |
| `npm test --prefix collaboration-server` | 129 passed |
| `npm run build --workspace website` | passed |
| `npx vitest run website/src packages/core/src` | 349 passed across 50 files |
| Relevant Admin + LH Radio Playwright tests | 37 passed / 1 skipped |
| Manual `/app/admin/radio` zero-track review | passed |
| `git diff --check` | passed |

## Next

Proceed to v0.8 Web Experience Visual Batch 2 without redesigning the accepted
Native LH Radio. Visual Batch 2 requires its own checkpoint and human review
before any v0.8 release preparation.
