# Product quality review — 2026-09-05

Base: `c707bc8ec9690c339c45085ad622c20413426a61` (v0.9.8).

This pass covers the public website, shared Arabic/English catalog, web workspace entry handling, desktop frontend copy, test entry points, and DeepL proxy rate-limit storage. The live website was inspected in both languages before editing. It is a verified improvement pass, not a claim that every native integration or production deployment path has been exercised.

## What changed

- Reworked **243 existing bilingual message entries** and added **7** explicit UI keys. The catalog now contains 1,262 keys. Arabic uses consistent product terms such as «النصوص»، «تعريب الألعاب»، «تفاصيل النص»، and «الرموز المحمية». English instructions and success messages are shorter and more specific. All 74 unique translator tips remain; selected tips were rewritten without changing the decks or discovery behavior.
- Migrated public page copy to explicit translation keys. The landing page, information pages, and shared header/footer now live in separate components instead of the application router. The legacy DOM translation bridge skips owned content subtrees; it remains for older workspace and desktop components.
- Added a language selector to the header, a keyboard skip link, a navigation label, clearer Arabic typography, and independent reading directions for source text, translations, and code. Preserved the existing section sequence, Captain Veyra example, radio, and hidden discoveries.
- Deferred the workspace and administration bundles until their routes are opened. The landing entry bundle fell from **633.17 kB to approximately 407 kB** minified, and from **181.62 kB to approximately 121 kB** gzip (about 36% and 33%). These are build artifact sizes, not measured production page-load times; route chunks still load when needed.
- Fixed `status:needs-review` search to use the saved workflow status. Previously it inferred status from translation text and missed reviewed entries.
- Kept untouched translations out of the live missing-token error queue. Nonempty translations still receive token checks; core export validation remains strict. Regression coverage checks both the untouched case and missing tokens in an actual translation.
- Replaced the DeepL proxy's unbounded client map with a bounded, expiring rate limiter. Active limits cannot be bypassed by evicting their entries when capacity is reached.
- Made `npm test` run the existing unit and server suites. Added portable Node entry points for server tests and website serving; removed Windows-only shell environment syntax from these paths and Playwright setup. Dependencies were not upgraded.
- Clarified browser-local storage, backups, desktop-only extraction, and what online translation sends to a provider. Fixed an English-only API-key paragraph in the Arabic privacy page. Removed the browser entry screen's unconditional offline claim.

## Copy direction

| Surface | English | Arabic |
| --- | --- | --- |
| Hero | Your game. Your words. | ألعاب تحبها. وترجمة تليق بها. |
| Context | Keep the context. Keep the code intact. | افهم الحوار. وحافظ على رموزه. |
| Workflow | From first draft to final review. | من أول مسودة إلى آخر مراجعة. |
| Language support | Arabic and English. Each reads the right way. | العربية والإنجليزية. لكل لغة اتجاهها. |

For future copy, describe the action and its outcome. Avoid literal translations of internal terms, repeated success filler, and claims broader than the feature actually supports. Keep game text and code unchanged when translating interface labels. Use readable Arabic for instructions; reserve conversational phrasing for greetings and hidden jokes.

## Verification

| Check | Result |
| --- | --- |
| Unit suites | 701 passed across 78 files |
| Server suites | 157 passed, 0 failed or skipped |
| i18n audit | 1,262 keys; no missing, duplicate, empty, conflicting, or mismatched interpolation entries reported |
| i18n tests | 6 passed (also included in the unit total) |
| Website production build | TypeScript and Vite passed |
| Desktop frontend build | TypeScript and Vite passed; the existing main-bundle size warning remains |
| Production dependency audit | No known advisories reported by `npm audit --omit=dev` at review time |
| Diff whitespace | `git diff --check` passed |

Browser checks covered the English/Arabic landing, Arabic privacy page, hidden Friday note and game shelf, and the real local sample workspace. A synthetic Arabic translation containing `{player_name}` and color tags was saved and restored; switching interface language preserved the original English source and Arabic translation. Untouched sample entries no longer appeared as token errors. Existing E2E expectations were updated to the new copy, but the full Playwright browser/device matrix was **not run** in this environment.

## Remaining work and release decisions

1. **Public downloads are blocked by repository visibility.** The live site's GitHub/release links point to `dedwrite/LocalizationHub`, which the GitHub API reports as private. Anonymous visitors cannot use those links. Choose a public installer distribution location, for example a separate public releases repository, and then update `website/src/config/site.ts`. Do not make the source repository public merely to repair a download button. Repository visibility and release distribution were not changed here.
2. **Verify the native Windows release.** The desktop frontend compiles, but this environment did not build a Tauri installer or exercise native extraction, filesystem dialogs, tool downloads, or signed Windows updates. Run those checks on the supported Windows toolchain before releasing a new installer.
3. **Run the E2E/device release gate.** Check narrow screens, Safari/WebKit, keyboard focus, cloud sign-in, and the existing radio scenarios in the project's normal test environment. Manual checks here do not replace that matrix.
4. **Confirm proxy trust against real infrastructure.** DeepL client identity still uses the existing forwarded-address handling. The deployment proxy must strip or validate client-supplied forwarding headers. Bounded rate-limit memory does not resolve spoofable client identity or provide a distributed limiter across multiple server instances.
5. **Continue incremental component migration.** The desktop application and collaboration server still contain large modules. Migrating remaining DOM-translated workspace components to explicit keys and splitting these modules requires focused regression coverage. This pass does not present a wholesale rewrite as a completed architectural cleanup.

No production deployment, merge, repository visibility change, or installer publication is part of this change set.
