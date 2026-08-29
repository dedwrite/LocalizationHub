# LocalizationHub v0.9 Arabic UI Checkpoint

Date: 2026-08-29  
Branch: `feature/v0.9-arabic-ui`  
Starting commit: `009d9164970c9058b41a48be89efe5de5f169ce3`  
Implementation commit: `f7e9c6ab001bd3e5685f5479122d94d40bf5983d`

## Scope

This checkpoint records the completed v0.9 full UI internationalization batch.
The product UI now has an explicit English/Arabic locale boundary across the
Desktop shell, public Landing page, Web App, Workspace, extraction flows,
Admin, and Native LH Radio surfaces. The batch does not merge main, release
v0.9, or start another visual batch.

## Locale architecture

- English is the deterministic fresh-install/default locale.
- Arabic is opt-in through the shared language switcher; the choice persists
  with `localizationhub.ui-locale.v1`.
- `I18nProvider` owns locale state, message lookup, interpolation, and root
  document `lang`/`dir`/`data-ui-locale` attributes.
- Catalogs are split by surface under
  `packages/i18n/src/messages/`, with shared styles and a compatibility DOM
  bridge for legacy/dynamic UI strings.
- User content, source/translation text, filenames, and technical values stay
  canonical and are explicitly isolated from chrome translation.

## Accepted coverage

- Public Landing and release/feature sections, including the Arabic direction
  and RTL-safe presentation.
- Web App projects, project entry list, toolbar, inspector, and workspace
  status/actions.
- Translation Workspace source/translation direction isolation: source content
  preserves its own direction while Arabic translation controls are RTL.
- Extraction/import, coverage, Admin, and error/empty/loading states.
- Native LH Radio coexistence, with transport controls kept in a stable LTR
  sequence and track metadata protected as content.
- Desktop shell and shared language-switcher styling, including mobile-safe
  placement.

## RTL and purity audit

The Arabic UI was browser-verified with `html[lang="ar"][dir="rtl"]`, no
horizontal overflow in the reviewed Landing and Workspace views, correct
source/translation direction attributes, and readable Arabic content. The
English UI remains the default and was also browser-reviewed.

The i18n audit reported:

- 891 catalog keys.
- 1,046 audited UI strings.
- Missing keys, duplicate keys, empty messages, interpolation mismatches,
  untranslated values, English conflicts, Arabic leakage, and Arabic source
  literals: none.
- Intentional user/content examples and technical values are exempted and
  marked at the content boundary.

## Files changed

The implementation is centered on `packages/i18n/` (provider, types, styles,
message catalogs, and tests), the i18n audit script and E2E spec, frontend and
website entry points, Workspace/Radio content-direction markers, parser-safe
English errors, and the developer i18n guide. Dependency manifests and the
lockfile were updated to wire the shared package into both web surfaces.

## Final gates

- Collaboration server: 140 tests passed.
- Combined Vitest (`packages/core/src`, `website/src`, `frontend/src`): 378
  tests passed across 54 files.
- i18n audit/Vitest: 5 tests passed.
- Website and frontend production builds passed.
- Rust: 13 Cargo tests passed; `cargo check` passed.
- Performance suite: 1 test passed.
- Focused Playwright: i18n 2 passed; mobile workflow 6 passed.
- `node --check collaboration-server/server.mjs` passed.
- `git diff --check` passed (with the repository's existing CRLF
  normalization warning only).

The first complete local Playwright run was 731 passed, 134 failed, and 105
skipped. Its failures were environment/test-fixture related: the Playwright
server command does not load the ignored `.env.local`, producing missing
`DATABASE_URL` errors, plus existing mock-dependent Web Save/Radio flows. A
second environment-assisted run was interrupted and is not counted as a
complete gate. No secret or test-environment change was committed.

## Known limitations

- Full Playwright remains dependent on the local test runner loading the
  developer database environment; this checkpoint does not change that secret
  loading policy.
- Desktop/Tauri visual screenshots were not captured in the browser session;
  browser review covered Landing and Workspace English/Arabic states.
- Deliberate user/content and technical-value exemptions remain canonical and
  are not translated as UI chrome.

No release or merge is implied by this checkpoint.
