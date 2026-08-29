# LocalizationHub v0.8 — Visual Batch 2 Checkpoint

Date: 2026-08-29  
Branch: `feature/v0.8-web-experience`  
Starting commit: `4e093e4` (`checkpoint-v0.8-native-lh-radio-human-accepted-2026-08-29`)

## Status

Visual Batch 2 is implemented and ready for human acceptance. This checkpoint does not claim visual human acceptance and does not include release preparation or Visual Batch 3.

## Landing and web-app changes

- Added a restrained dark ambient system with grid/radial depth, hero aura, signal chips, and small motion details.
- Strengthened the extraction story with a four-step pipeline, explicit status labels, and truthful Godot/Unreal/Unity engine signals.
- Added a protected-token context demonstration showing source, translation, speaker, listener, and scene metadata without changing the product model.
- Added reduced-motion behavior and preserved the existing information architecture, routes, and LH Radio treatment.
- Added Cloud/Local context navigation, real project summary metrics, richer project cards, search/result affordances, intentional empty states, and a truthful local-first tip.
- Restyled the Local workspace shell and file-opening surface while retaining existing parsing/editor behavior and browser-project compatibility.
- Kept the workspace editor architecture and muscle memory intact; no Native LH Radio redesign was made.

## Responsive and accessibility review

- Responsive CSS covers the existing 360, 390, 430, 768, 1024, and 1440px review widths.
- Mobile navigation remains the source of truth at narrow widths; Cloud/Local context controls remain available without introducing horizontal overflow.
- Existing focus-visible treatment was preserved; the new context controls meet contrast requirements.
- `prefers-reduced-motion` disables the new ambient and interaction transitions.
- Playwright accessibility coverage passed, including the existing axe checks.

## Performance

- The polish is CSS and existing React markup only; no new runtime dependency or image payload was introduced.
- Production build and the repository performance gate passed.

## Browser review captures

- Landing hero: `http://127.0.0.1:8787/`
- Extraction story: `http://127.0.0.1:8787/#extraction`
- Context demonstration: `http://127.0.0.1:8787/#context`
- Formats/lower landing: `http://127.0.0.1:8787/#formats`
- Cloud Projects: `http://127.0.0.1:8787/app/projects`
- Local workspace: `http://127.0.0.1:8787/app/local`
- Representative project editor was opened from the Projects view during review.
- Console error/warning review returned no entries on the final local review session.

## Gates

- `node --check collaboration-server/server.mjs` — passed
- `npm test --prefix collaboration-server` — 129 passed, 0 failed
- `npm run build --workspace website` — passed
- `npx vitest run website/src packages/core/src` — 50 files, 349 tests passed
- `npm run test:performance` — 1 passed
- `npx playwright test tests/e2e/web-app.spec.ts` — 160 passed
- `npx playwright test` — 751 passed, 95 skipped
- `git diff --check` — passed

## Known limitations

- Visual human acceptance is still pending.
- `duration_seconds` remains a documented Radio backend limitation from the accepted Native LH Radio checkpoint.
- Recent Activity remains truthful to the current backend data surface; no synthetic activity was added.
- Public Radio data in a no-database test server logs the existing unavailable state; the accepted Radio implementation remains unchanged.

