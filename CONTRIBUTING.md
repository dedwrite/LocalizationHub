# Contributing to LocalizationHub

Start with a reproducible issue or a small pull request. Discuss changes to parsers, storage, authentication or release infrastructure before a large implementation. Security reports belong in the private process in [SECURITY.md](SECURITY.md), not public issues.

## Development

Use Node.js 24 LTS and npm. Run commands from the repository root:

```sh
npm ci
npm run website:dev
```

The website runs at `http://127.0.0.1:5174`. Browser Local Projects and the Northern Gate sample require no production credentials. Use synthetic fixtures, not real game files or account data, in tests and screenshots.

For a same-origin backend, configure your own PostgreSQL database and an ignored `collaboration-server/.env.local`, run `npm run db:migrate --workspace collaboration-server`, then `npm run dev --workspace collaboration-server`. Never point development or tests at the production database. Migration and configuration details are in [the backend guide](docs/development.md).

For the Windows desktop client, install stable Rust, MSVC C++ build tools and WebView2. See [frontend/README.md](frontend/README.md).

## Checks

```sh
npm test
npm run test:i18n
npm run website:build
npm run build --prefix frontend
npx playwright install chromium
npx playwright test tests/e2e/public-download.spec.ts --project=desktop --project=phone-390
git diff --check
```

Server tests use isolated fixtures, including PostgreSQL/WASM for lifecycle tests; they must not need production secrets. The full Playwright matrix additionally needs WebKit and its system dependencies. On Linux use `npx playwright install --with-deps chromium webkit`.

## Change conventions

- Keep first-party changes under MIT and retain third-party notices.
- Preserve source structure, metadata, IDs, placeholders and formatting tags through import/export.
- Keep engine limitations accurate; external extraction tools are optional and separately installed.
- Update both English and Arabic catalogs under `packages/i18n/src/messages/`. Preserve interpolation variables and test RTL independently of the source text direction.
- Keep Cloud role enforcement server-side. A public download does not make Cloud data public.
- Add a focused regression for behavior changes. Do not delete tests to make a failing build pass.
- Use a feature branch and focused commits. Describe the problem, solution, tests and screenshots where relevant in the PR. The maintainer reviews compatibility, security and data preservation before merging.
- Do not include `.env.local`, tokens, user databases, copyrighted game assets, extracted dialogue, private logs or generated installers in commits.

Use the bug template for reproduction steps, expected/actual behavior and platform details. Never include real credentials. Requests for injection, DRM bypass, archive decryption or arbitrary executable modification are outside the supported extraction workflow.
