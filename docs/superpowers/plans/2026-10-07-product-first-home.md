# Product-first Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Execution method remains subject to human review; no delegation has been selected.

**Goal:** Implement approved Figma V3 Home with isolated reusable foundations, preserving existing functionality, then stop for human review.

**Architecture:** Add an opt-in shared UI workspace package, consumed only by the new Home. Keep the existing Landing intact at `/product`; the new demonstration uses local React state and existing core token validation, not authenticated Workspace initialization. Preserve the current application, backend, Radio and desktop surfaces.

**Tech Stack:** React 19, TypeScript 6, Vite 8, CSS, Vitest, Playwright, existing npm workspaces and EN/AR provider. No new UI or animation framework.

**Spec:** `docs/design/2026-10-07-ecosystem-audit.md`, sections 15–17; approved Figma file `2HXP41gFB3SlflvspNAiHv`, Home nodes `8:3`, `8:83`, `8:163`.

## Global Constraints

- Home only after foundations; Product Details redesign and all other migrations deferred.
- Branch `design/full-product-redesign`; version stays `0.9.8`.
- No push, production deployment, release, tag, DB writes, migrations or secret changes.
- Existing GitHub repository remains private; action must explicitly communicate private access.
- Download remains `/download`, the current private Windows tester access flow.
- Preserve current tips/secrets with existing long-form content, and global CommandCenter/LH Radio; do not resurrect deliberately removed Konami behavior.
- New copy uses explicit EN/AR keys and skips the legacy DOM translation adapter.
- Figma SVG assets must be locally bundled from its provided URLs, preserving geometry. No screenshot-as-UI.
- Resolve a licensed local Inter asset with its license before adoption; retain existing Noto Arabic. No remote font runtime dependency.

## Review Focus

1. Typing during autoplay must stop progression and never overwrite the user's translation (Task 2).
2. Hidden tab/offscreen/reduced-motion must not run an invisible story or announce repeated results (Tasks 2 and 4).
3. Arabic with Latin placeholders must preserve reading order, selection and keyboard editing at 360px (Tasks 2 and 4).
4. Existing fragment URLs and prerender hydration must not lose destinations or produce duplicate/mismatched content (Task 3).
5. Shared CSS must not alter app/Admin/Radio appearance or introduce horizontal overflow (Tasks 1 and 4).

## Task 1: Opt-in foundations

**Files:** Create `packages/ui/package.json`, `packages/ui/src/index.tsx`, `packages/ui/src/theme.css`, `packages/ui/src/ui.test.tsx`; modify `website/package.json`, root `package-lock.json`. Bundle licensed typography under `website/public/fonts/` only after resolving its source/license.

**Interfaces:** Produce `UiTheme({children, className?})`, `ActionLink({href, children, variant?: 'primary' | 'quiet', ...nativeAnchorProps})`, `IconButton({label, children, ...nativeButtonProps})`, `StatusBadge({children, tone?: 'neutral' | 'success' | 'warning'})`. Export CSS explicitly as `@localizationhub/ui/theme.css`. No global theme activation.

- [x] Write tests `theme_is_opt_in`, `action_preserves_native_link_semantics`, `icon_button_has_accessible_name`, `disabled_button_stays_disabled`, and `css_does_not_target_unscoped_root_or_app`. Assert no global `:root`, `body`, `button` or app selectors in the new sheet; theme variables live under `[data-lh-theme="product"]`.
- [x] Run `npx vitest run packages/ui/src`; confirm failures reference missing implementation rather than test harness errors.
- [x] Implement the interfaces using native elements. Tokens: canvas `#050505`, surface `#070808`, raised `#0b0c0b`, line `#1a1d1c`, text `#f2f5f0`, secondary `#7d827d`, accent `#bafa61`; use measured accessible label variants, reserving `#383d3b` for decoration. Use logical spacing, visible focus and 44px coarse-pointer targets. Motion durations 140/240/400/600ms; reduced-motion disables nonessential motion.
- [x] Run the new tests plus `npx vitest run website/tests/appPalette.test.ts`; all pass. Build website to verify workspace export resolution.
- [x] Commit only foundation files: `feat(ui): add opt-in product-first foundations`.

## Task 2: Demo model and motion controller

**Files:** Create `website/src/productHome/demoModel.ts`, `demoModel.test.ts`, `useDemoStory.ts`, `useDemoStory.test.tsx`.

**Interfaces:** Export `DemoStage = 'select' | 'translate' | 'validate'`; `DemoEntry = {id: string; source: string; translation: string}`; `demoEntries: readonly DemoEntry[]`; `validateDemoTranslation(source: string, translation: string): {valid: boolean; missing: string[]}` using existing generic token validation. Export `useDemoStory({reducedMotion, visible})` returning `{stage, entry, translation, paused, selectEntry, editTranslation, validate, pause, replay}`. The model owns timer scheduling; JSX does not.

- [x] Write tests asserting `{player_name}` retained => valid; removed/changed/duplicated => invalid according to core rules; empty translation never yields ready. Assert selection resets validation and count equals actual data length.
- [x] Write fake-timer tests for select → translate → validate → reset; editing/selection takes over; replay explicitly restarts; hidden/offscreen pauses; reduced motion starts complete and does not schedule playback; unmount cancels timers. No persistence/network writes.
- [x] Run `npx vitest run website/src/productHome`; confirm intended failures.
- [x] Implement the pure model and hook. Initial holds: select 1800ms, translate 2400ms including a 600ms reveal, validated 2800ms, then reset; adjust only after visual verification. Reduced-motion output is static completed example. Manual edits never autoplay again without replay.
- [x] Run tests with fake timers; all pass, no pending timers after unmount.
- [x] Commit: `feat(web): add safe editor demonstration controller`.

## Task 3: Home and route preservation

**Files:** Create `website/src/productHome/HomePage.tsx`, `EditorDemo.tsx`, `home.css`, `home.test.tsx`, `legacyAnchors.ts`; modify `website/src/App.tsx`, `website/src/publicMetadata.ts`, `website/vite.config.ts`, `website/public/sitemap.xml`, `packages/i18n/src/messages/index.ts`; create `packages/i18n/src/messages/productHome.ts`. Keep existing `pages/LandingPage.tsx` content as the interim `/product` route. Modify existing public navigation/tests only where route semantics changed.

**Interfaces:** `HomePage()` consumes Task 1 primitives and Task 2 controller; `EditorDemo()` contains native selection buttons, editable target field, Validate, Pause/Replay. `legacyProductDestination(hash: string): string | null` returns `/product#...` only for actual existing section IDs, otherwise null. Public metadata registers `/product`; Vite continues rendering the real React tree into each public route.

- [x] Write Home tests: exact English headings “The editor is the product.” and “Open files. Translate. Validate. Export.”; editor link `/app/local`, details `/product`, docs `/reference`, download `/download`; GitHub labelled private. Assert no long feature tower in Home, both locales render, source stays LTR and Arabic target RTL with isolated placeholder. `/product` retains current content and secrets.
- [x] Add route/SSR tests: `/product` has its own canonical/title and real HTML, Home prerenders meaningful demo and working links, old known fragment resolves to preserved section, unknown fragment does not redirect, initial client markup matches server markup.
- [x] Run `npx vitest run website/src/productHome website/tests`; confirm expected failures before implementation.
- [x] Implement V3 layout: desktop gutters approximately 64px, 270px rail, dominant 700px editor at 1440px; 30px source and 32px Arabic reference scale. Compact header and footer, near-black surfaces and selective lime. Source/source context remains factual and illustrative. Use Figma assets locally. Do not import the real Workspace into Home.
- [x] Add EN/AR keys and truthful private-access labels. Use editable RTL target with isolated token preview; native textarea value remains plain text. Animation reveals from the physical right, never announces automatic cycles; manual validation uses one polite status.
- [x] Preserve long content at `/product`, audit its links so section links stay on `/product`, map old incoming Home hashes, update metadata/schema/theme color/font preload/sitemap for new route truth. Do not restyle Product Details yet.
- [x] Run targeted tests, `node scripts/i18n-audit.mjs`, `npm run build --workspace website`; all pass. Inspect built `dist/index.html` and `dist/product/index.html` for distinct real content/canonicals.
- [x] Commit: `feat(web): implement product-first Home and preserve product details`.

## Task 4: Browser verification and local handoff

**Files:** Create `tests/e2e/product-first-home.spec.ts`; adjust existing public tests for the intentional `/product` relocation without weakening their assertions; update the audit/planning evidence with actual results.

- [x] Add Playwright assertions at 1440, laptop 1280, tablet 768, mobile 430/390/360 in EN/AR: no horizontal overflow, readable source/target, usable selector, keyboard reachability, visible focus, accessible names and axe serious/critical issues zero.
- [x] Test real token removal/manual validation, edited content not overwritten after a full autoplay cycle, selection reset, pause/replay, reduced-motion static output, offscreen/hidden-tab scheduling, no console/page errors, legacy anchors and JS-disabled navigation.
- [x] Exercise Chromium and actual WebKit projects from existing config. Capture desktop/mobile EN/AR screenshots. Inspect them directly against all three approved Figma states; do not equate build success with visual acceptance.
- [x] Run `npx vitest run packages/ui/src website/src/productHome packages/core/src/tokens packages/i18n/src website/tests website/src/lhRadio`, `node scripts/i18n-audit.mjs`, `npm run build --workspace website`, relevant public/app/Admin/LH Radio Playwright smoke and `git diff --check`. Report actual totals and any coverage limitations; do not claim authenticated production tests.
- [x] Verify existing local review startup before launching; reuse project startup method without dropping ignored environment config. Do not print env values, kill unrelated processes or change production. Keep local preview running and open Home for human review.
- [x] Commit only any final verified fixes and evidence. Report branch, commits, test counts, screenshot locations, local URL and deferred surfaces. Stop for human Home acceptance; no push or later migration.

## Plan self-review

Spec coverage: foundations = Task 1; real DOM motion and safe validation = Task 2; V3/RTL/links/content preservation/prerender = Task 3; responsive/accessibility/regressions/review gate = Task 4. All five Review Focus conditions have explicit owning tests. No backend or desktop implementation is included. The exact local review port will be determined from the current process inventory, not assumed from historical context.
