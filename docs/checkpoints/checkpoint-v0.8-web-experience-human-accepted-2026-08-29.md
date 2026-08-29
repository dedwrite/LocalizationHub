# LocalizationHub v0.8 — Web Experience Human Acceptance Checkpoint

Date: 2026-08-29  
Branch: `feature/v0.8-web-experience`  
Accepted HEAD: `1981e7f` (`fix(web): style workspace scrollbars for dark theme`)

## Human acceptance

The final v0.8 Web App / Workspace visual state was manually reviewed and accepted:

> كلشي كويس اختبرته بنفسي

The acceptance covers the public Landing page, Web App shell, Projects, Local Projects, Translation Workspace, RTL/Arabic presentation, entry list, toolbar, Inspector, LH Radio coexistence, and the final dark-theme scrollbar follow-up.

## Accepted Landing polish

- Visual Batch 2 Landing composition remains accepted, including extraction, context, protected-token safety, workflow, format, and release surfaces.
- The context/protected-token demo uses the polished Developer → Translator Friday hotfix example with a readable `Friday · 11:59 PM` scene, RTL Arabic translation, and clearly highlighted `{new_strings}` / `<color=#A86BFF>` protected tokens.
- Current-facing FAQ release copy is aligned to v0.7.0; historical checkpoint and release documents remain unchanged.

## Accepted Web App polish

- Cloud/Local context is explicit and the Projects page has truthful loading, empty, search, error, single-project, and multi-project states.
- Single-project support actions, balanced multi-project grids, header hierarchy, focus rings, panel depth, and responsive layouts were accepted.
- Local Projects file import/edit/export flows remain stable and visually integrated.

## Accepted Workspace deep polish

- The three-pane translator architecture remains intact with a focused center content column.
- Reference/Source and Working Copy/Translation hierarchy, protected-token context, translation typography, entry density, keyboard selection, toolbar actions, Save state, Inspector tabs, metadata, and Focus mode were accepted.
- Responsive behavior and reduced-motion handling remain preserved across the reviewed viewport families.

## Accepted RTL behavior

- Arabic translation content remains correctly right-to-left and right-aligned where appropriate.
- Mixed-direction protected tokens and source/translation context remain readable without weakening token safety.

## Accepted Native LH Radio coexistence

- Native LH Radio remains accepted and coexists with the Web App/Workspace surfaces.
- No Radio Batch 2 or unrelated Radio redesign was started as part of this checkpoint.

## Accepted dark scrollbar follow-up

- Entry-list, editor, Inspector, Overview, mobile workspace, and related Local entry scroll surfaces use a restrained dark-theme scrollbar.
- WebKit track/thumb styling and Firefox `scrollbar-color` fallback remove the bright native-looking white bar while preserving a usable hit target, rounded thumb, hover/active states, and stable layout.

## Relevant final gates

- `node --check collaboration-server/server.mjs` — passed
- `npm test --prefix collaboration-server` — 129 passed
- `npm run build --workspace website` — passed after the scrollbar follow-up
- `npx vitest run website/src packages/core/src` — 50 files, 349 tests passed
- `npx vitest run website/src` — 10 files, 60 tests passed after the scrollbar follow-up
- Targeted Web App Playwright — 19 passed after the scrollbar follow-up
- Full Playwright — 791 passed, 105 skipped, 0 failed
- `git diff --check` — passed

## Current known limitations

- `duration_seconds` remains the documented LH Radio backend limitation.
- Authenticated Cloud Projects review screenshots depend on a signed-in review session; automated fixtures cover deterministic project states without changing real user content.
- v0.8 release preparation and merge to `main` have not started.

