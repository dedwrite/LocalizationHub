# Web quality audit — 2026-09-30

## Baseline and scope

Fast-forwarded the clean local `main` from `c707bc8` to GitHub's `ed66957` before editing: eight remote commits and 60 changed/new paths were brought onto the PC. No remote-only unmerged branches remained. This is a website/product-quality batch, not a version, release, tag or infrastructure change.

## Improvements

- Public pages (`/`, `/privacy`, `/terms`, `/download`) now contain the real rendered React content in raw HTML and hydrate on the client, rather than offering only metadata and a separate noscript summary. Route metadata, canonical links, social previews and indexing policy are consistent; private routes use a separate noindex app shell.
- The Northern Gate sample is a real, editable 24-entry bilingual game project. It demonstrates speaker/listener context, protected syntax, terminology, comments, review states and one intentional QA exercise. Each opening creates an independent project; saving and original-format export are tested.
- Direct Local Workspace loading now owns its required styles. Entry lists retain usable mobile scrolling, show correct review states and real filter counts, and preserve the dark violet theme. The sample choice and inline tour make first use clearer.
- Mobile public navigation, platform-specific shortcut labels, localized quick commands and RTL focus restoration were improved. Explicit section navigation remains smooth, while global scrolling no longer races restored focus in Safari.
- The current game-first Landing order/copy, all 74 translator tips and existing secrets are preserved. Admin MFA and accepted LH Radio behavior are unchanged.

## Final gates

- Vitest: 714 passed across 82 files.
- Collaboration server: 158 passed; syntax check passed.
- Playwright: 392 passed, six intentional device-specific skips across desktop, 360px phone, Safari desktop and 390px iPhone profiles. Covers public quality, delight, Radio, visual/accessibility checks, Web App, local parity/save, Safari, i18n and Admin.
- Additional repeated sample/tip lifecycle checks: 36 passed.
- Website and desktop UI builds passed. i18n audit passed with 1,326 keys; production dependency audit reported zero known vulnerabilities. `git diff --check` passed.

## Hosting and limitations

Inspected the existing `dedwrite` Render service, main auto-deployment and health endpoint without changing configuration, secrets or database records. Baseline production and local review health were HTTP 200. Local review runs through the existing `dev.mjs` environment-loading path on port 8788.

This audit does not claim exhaustive testing of every feature or native installer packaging. The desktop UI build retains its existing large-chunk warning. Existing layered CSS and externally hosted fonts remain; no broad stylesheet migration was attempted. Browser Local Projects still require explicit backups, and game-folder extraction remains a supported Windows-app operation, not a browser capability.
