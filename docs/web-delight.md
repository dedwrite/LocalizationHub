# Web delight — v0.9.3

This follow-up adds contextual field notes, resume-work cards and two small
Easter eggs. It ships in v0.9.3 and does not change LH Radio playback.

## Field notes

- 64 distinct tips, each written in English and Arabic.
- Five contextual decks, 14 tips each (some useful tips belong to more than one
  deck): Landing, Local files, Cloud projects, editing and review.
- A shuffled bag exhausts the current deck before repeating, and avoids an
  immediate repeat across bag boundaries. The bag is in component memory: a new
  visit/remount starts a new shuffle. Locale changes do not reshuffle it.
- No timer changes the tip while someone types. Another tip is an explicit
  action. Hiding/showing retains keyboard focus.
- Hidden preferences use `localizationhub.tips.hidden.<context>.v1`; each deck
  can be hidden and restored independently. Unavailable storage never blocks UI.
- On phones, workspace tips live inside the Tools Inspector, not in the typing
  area. Quality/Glossary select the review deck; other tabs use the editing deck.

## Resume-work cards

Local shows the newest valid `savedAt` timestamp among existing browser copies.
The card derives coverage and selected entry from that saved copy, then calls
the same existing open handler. It does not save or rewrite data automatically.
It means **last saved**, not unsaved edits or a cross-device backup.

Cloud records the successfully opened project ID in the optional, account-scoped
`localizationhub.recent-cloud.<encoded-user-id>.v1` preference. No names, project
contents, translations or credentials are stored in this bookmark. The card
only resolves IDs against the current authorized project list. A missing/deleted
ID falls back to the most recently updated accessible project, explicitly
labelled as updated rather than opened. API errors, verification gates, loading
and active search suppress the resume card. Normal server permission checks
still apply when opening it.

Coverage means entries with nonblank text, not approval or QA success. Empty
projects do not receive a completion message; partial percentages round down.
The full-coverage note explicitly recommends a final review.

## Discoveries and visual details

1. The small `{…}` button in the public footer reveals a translator secret on
   the third click/keyboard activation. Another activation or Escape closes it.
2. The existing Friday · 11:59 PM demo clock reveals an extra hotfix note on
   activation. Its original source, Arabic translation and protected tokens are
   unchanged. Activate again or press Escape to close it.

Both discoveries are inline/non-modal, accessible in both languages, silent and
local-only. They never intercept global keyboard shortcuts or modify content.
The footer reserves clearance for collapsed Radio, and the mobile note stays
inside the footer's viewport bounds in both directions.

New surfaces share muted purple borders, small token motifs and restrained
progress presentation. Saved-state color feedback is brief; reduced-motion
preferences disable it. There are no new image requests, telemetry, timers,
dependencies, backend endpoints or migrations.

## Regression coverage

`tests/e2e/web-delight.spec.ts` covers shuffled tips, locale round trips,
hide/show focus and persistence, denied preference storage, Local saved-entry
resume without uploads, Cloud account scoping and stale/deleted/failed lists,
keyboard discoveries, mobile overflow, actual Radio clearance, icon geometry
and workspace typing stability. It runs in the existing ten-project
Chromium/WebKit matrix (desktop, phones, tablets, iPad).

Twelve unit cases cover all 64 bilingual tips, deck cycles, preference storage,
timestamp selection, malformed optional values, exact coverage and account
bookmark isolation. Existing save/migration/viewer tests now locate the exact
Translation textbox instead of partially matching every labelled element that
contains “translation”; their assertions and permissions checks are unchanged.

Local review uses the existing ignored development configuration through
`collaboration-server/dev.mjs`, on http://127.0.0.1:8788/. No secrets belong in
this document or the repository.
