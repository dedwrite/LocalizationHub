# Development map

Run npm commands from the repository root unless a workspace is explicitly selected. Node.js 24 LTS is the contributor/CI baseline; Windows Desktop additionally needs stable Rust, MSVC C++ build tools and WebView2.

| Directory | Responsibility |
| --- | --- |
| `website/` | Public prerendered routes, browser Local/Cloud editor and Admin UI |
| `frontend/` | Desktop React client |
| `packages/core/` | Shared parsing, project models, export and token validation |
| `packages/i18n/` | Shared English/Arabic messages and direction handling |
| `packages/ui/` | Shared product theme and UI primitives |
| `src-tauri/` | Rust/native desktop host and Windows installer configuration |
| `collaboration-server/` | Accounts, authorization, Cloud API, WebSocket relay and public serving |
| `tests/e2e/` | Chromium/WebKit browser tests, including isolated Desktop React flows |

## Backend development

`npm run dev --workspace collaboration-server` loads the ignored `collaboration-server/.env.local`; `npm start --workspace collaboration-server` deliberately does not. `LOCAL_ENV=test` selects `.env.test.local`. Use a dedicated development PostgreSQL database and never production data. Apply its schema with `npm run db:migrate --workspace collaboration-server`.

Required database configuration is `DATABASE_URL`; `DATABASE_SSL=1` enables the existing SSL connection option when your database requires it. `PORT` selects the listener. Set `ENABLE_EXPERIMENTAL_CLOUD_API=1` to enable Cloud routes. To serve the built site from the same origin, run `npm run website:build` and set `SERVE_PUBLIC_WEBSITE=1` before starting the backend. The health endpoint is `/health`.

Transactional email needs your own `RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_VERIFICATION_PUBLIC_URL`. Admin MFA additionally needs a stable `ADMIN_SECURITY_KEY`. Do not generate or replace a key for an existing enrollment: it encrypts existing TOTP secrets. Do not commit any of these values. Automated server tests inject fixtures instead of requiring these services.

The public values in `frontend/.env.production` are intentional build-time API/WebSocket endpoints, not secrets. Use a local override for development; never embed private keys in `VITE_*` variables.

## Public routes

`/`, `/product`, `/download`, `/reference`, `/godot`, `/unreal`, `/unity`, `/formats/json`, `/formats/po`, `/features/translation-memory`, `/privacy`, `/terms` are public product/reading routes. `/verify-email` is served by the backend. Unknown public paths get a not-found view.

`/app/local` is account-free browser editing. `/app/login`, `/app/register` and `/app/projects/:id` support authenticated Cloud workflows; `/app/admin` and its user/project/audit/radio subroutes retain separate Admin authorization. Workspace routes are not indexed product pages.

## Deployment boundary

The existing Render `localizationhub-relay` service builds `npm ci && npm run website:build`, migrates with `npm run db:migrate --workspace collaboration-server` and starts `npm start --workspace collaboration-server` from `main`. Never change production configuration as a side effect of documentation or frontend work.

The unrelated AFTERHOURS gateway was removed from the current tree after confirming both associated Render services use `dedwrite/afterhours`, branch `migration/cloudflare`, not a file in this repository. Historical commits remain intact. No AFTERHOURS infrastructure or data was changed.
