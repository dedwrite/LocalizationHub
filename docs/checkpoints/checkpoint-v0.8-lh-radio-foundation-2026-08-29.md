# LocalizationHub v0.8 — LH Radio Foundation

## Status

v0.8 "Web Experience Update" — first foundation batch is implemented on the
`feature/v0.8-web-experience` branch. This batch is the **global app shell +
LH Radio (Spotify playlist embed) foundation**. It intentionally does **not**
redesign the landing sections, project cards, or dashboard; that is the next
batch after human visual review of LH Radio.

## Branch & commits

- Branch: `feature/v0.8-web-experience`
- Starting commit: `604ed44ec1462c2ac8c704b55e58915d3d97dd3b` (origin/main, v0.7.0 base)
- Final commit: `fc6d1ce` (implementation + checkpoint)

## What was implemented

1. **Global app-shell placement** — `App` now renders `<RoutedPage />` and a
   single `<LhRadio />` sibling, so one global player survives all SPA route
   transitions (Landing → Download → Web App → Projects → Workspace → Privacy/Terms).
   The player is suppressed on `/app/admin*` (a focused, MFA-gated operator surface).

2. **Safe internal navigation foundation** — `website/src/internalNavigation.tsx`
   provides `InternalLink` (plus pure `isExternalHref` / `isModifiedClick` /
   `parseInternalTarget` / `shouldInterceptClick` helpers). Same-origin links
   route through `history.pushState` instead of a full document reload, while
   external links, modified clicks, open-in-new-tab, and hash-only anchors keep
   native browser behavior. Landing header/nav/CTA, footer brand, and the 404
   back link were migrated.

3. **Official Spotify playlist integration** — `website/src/lhRadio/` loads
   Spotify's Embed/iFrame API (`https://open.spotify.com/embed/iframe-api/v1`)
   lazily and creates the official playlist embed for `51C0wJDmneyIteIyDdztoU`
   (`spotify:playlist:51C0wJDmneyIteIyDdztoU`). No OAuth, no Premium, no Web
   Playback SDK, no locally cached audio, no scraping.

4. **LH Radio component** — collapsed capsule (equalizer, play/pause, Spotify
   attribution) + expanded panel (official embed, `SPOTIFY PLAYLIST` label,
   `LOCALIZATIONHUB / FOCUS MODE`, "Open in Spotify"). Playback begins only from
   a user gesture; the embed is created lazily on first expand/play.

5. **Responsive / mobile** — mobile pill and bottom-sheet use
   `env(safe-area-inset-bottom)` and clear the Web App bottom navigation. On app
   surfaces (desktop/tablet) the player docks bottom-left so it never covers the
   right-side workspace inspector or editor navigation.

6. **Graceful fallback** — script-blocked / network / embed errors render
   "Spotify unavailable — Open playlist ↗" without affecting the app.

7. **Privacy** — the Privacy page gained a concise "Music and third-party embeds"
   disclosure.

8. **Accessibility** — keyboard focus, visible focus rings, aria labels, and
   `prefers-reduced-motion` (the equalizer animation becomes static).

## Spotify integration method

Official **Embed / iFrame API** (`open.spotify.com/embed/iframe-api/v1`,
`IFrameAPI.createController`) driving the official playlist embed. The custom
LocalizationHub UI is only a shell; Spotify branding and "Open in Spotify" are
kept visible in both states.

## Gates (all exit code 0)

| Gate | Result |
|---|---|
| `npm run build --workspace website` | 0 |
| `npx vitest run website/src packages/core/src` | 0 — 346 passed (was 331) |
| `npx playwright test` | 0 — 641 passed / 95 skipped |
| `npm run test:performance` | 0 |
| `git diff --check` | 0 |

## Tests added

- Unit (`vitest`): `website/src/lhRadio/lhRadioState.test.ts` (reducer +
  persistence), `website/src/internalNavigation.test.ts` (link classification).
- E2E (`playwright`): `tests/e2e/lh-radio.spec.ts` — single global player, SPA
  persistence, collapsed/expanded, no autoplay before gesture, Spotify failure
  fallback, internal nav avoids reload, external links stay external, mobile
  capsule clears bottom nav. The Spotify iFrame API is stubbed via `page.route`;
  no test depends on Spotify's live network.

## Known limitations

- The Spotify Embed/iFrame API does not expose volume control, so no volume UI
  is provided in this batch.
- First-play from the collapsed capsule relies on the browser allowing the embed
  to start after the user gesture; `autoplay_failed` is surfaced gracefully.
- The Chrome `phone-*` Playwright projects emulate a 393px device screen against
  narrower viewports, so fixed-bottom elements sit slightly below the visual
  viewport; keyboard-activation is used in the capsule tests to stay robust.

## Next visual batch (after human review of LH Radio)

- Landing: background depth, ambient motion, section transitions, stats/hints.
- Web App: project cards, search, headers, empty states, account area, local/cloud
  switching, workspace shell hierarchy.
