# LocalizationHub v0.8 — Web App + Workspace Deep Polish Checkpoint

Date: 2026-08-29  
Branch: `feature/v0.8-web-experience`  
Starting commit: `f8f825d` (`checkpoint-v0.8-web-visual-batch-2-2026-08-29`)

## Status

Visual Batch 3 Web App + Workspace deep polish is implemented and ready for human visual acceptance. Landing was kept as the accepted Visual Batch 2 base, with only the stale current-facing FAQ copy corrected. Native LH Radio remains human accepted and unchanged.

## Stale copy fixes

- Updated the public FAQ answer from the historical v0.4.0 reference to the current stable `v0.7.0` release.
- Audited current-facing landing release copy; historical release/checkpoint documentation was not rewritten.
- Refined the existing protected-token context demo with the personality-driven but product-relevant Friday hotfix example: Developer → Translator, `Friday · 11:59 PM`, RTL Arabic translation, and highlighted `{new_strings}` / `<color=#A86BFF>` tokens.

## Projects and Web App shell

- Added a deliberate single-project composition: the real project card remains compact while a supporting panel exposes truthful source, coverage, role/revision, and quick actions.
- Multi-project grids now fill available space with balanced adaptive columns; the one-project state does not stretch a lone card across an empty canvas.
- Kept Cloud/Local context labels explicit, compact, and collaborative rather than tier-oriented.
- Tightened application header balance, panel depth, ambient technical structure, focus rings, and action hierarchy.
- Existing loading, empty, search, and error surfaces remain actionable and visually integrated.

## Workspace deep polish

- Added a readable center content column while preserving the three-pane architecture and long-dialogue space.
- Differentiated `REFERENCE / Source` from the strongest-focus `WORKING COPY / Translation` surface.
- Improved translation typography, line-height, padding, focus treatment, protected-token context, and RTL readability without changing editor behavior.
- Entry rows retain virtualized density, now expose status in their accessible labels, support keyboard selection, and keep status colors restrained.
- Toolbar groups preserve every existing action while making Save and utility clusters easier to scan.
- Inspector tabs, metadata, empty states, and history/comment/memory cards now have clearer hierarchy.
- Focus mode is visually intentional and centers the editor while hiding distractions.
- Native LH Radio and bottom navigation behavior remain preserved.

## Responsive and accessibility review

- Verified the required 360, 390, 430, 768, 1024, 1280, and 1440px families through existing responsive Playwright projects and overflow assertions.
- Added/updated checks for single-project composition, multi-project grid balance, FAQ freshness, workspace source/translation hierarchy, keyboard entry selection, and Focus mode.
- Axe serious/critical checks pass across the workspace and existing application surfaces.
- Reduced-motion behavior remains respected; no new motion is required for translation work.

## Browser screenshots reviewed

- Landing FAQ with the v0.7.0 answer expanded: `http://127.0.0.1:8787/#faq`
- Local Projects empty state: `http://127.0.0.1:8787/app/local`
- Previously captured Visual Batch 2 Landing, Projects, Local, and representative editor views remain the comparison baseline.

## Gates

- `node --check collaboration-server/server.mjs` — passed
- `npm test --prefix collaboration-server` — 129 passed, 0 failed
- `npm run build --workspace website` — passed
- `npx vitest run website/src packages/core/src` — 50 files, 349 tests passed
- `npm run test:performance` — 1 passed
- Targeted Web App + workspace Playwright — 80 passed before final a11y correction; 21 passed after correction
- Full `npx playwright test` — 791 passed, 105 skipped, 0 failed
- `git diff --check` — passed

## Known limitations

- Human visual acceptance is still pending.
- Native LH Radio remains at its accepted checkpoint; Radio Batch 2 was not started.
- `duration_seconds` remains the documented Radio backend limitation.
- Cloud Projects screenshots depend on an authenticated review session; automated fixtures provide deterministic multi-project coverage without changing real user content.
- v0.8 release preparation and merge to main were intentionally not started.
