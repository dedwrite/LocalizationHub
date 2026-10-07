# LocalizationHub — ecosystem audit

Date: 2026-10-07 (Asia/Riyadh). Scope: discovery, not a completed redesign.

Evidence: current source at `09478fb`, GitHub repository metadata, Render resource metadata, live public Home, Figma design contexts/screenshots for `8:3`, `8:83`, `8:163` and `22:3`. Authenticated operational flows were inspected in code, not exercised against production. No production data, credentials, emails or services were changed.

## 1. Local project map

Root: `H:/LocalizationHub`. npm workspaces with a root `package-lock.json`:

| Path | Responsibility |
| --- | --- |
| `website/` | React 19, TypeScript 6, Vite 8; public site and browser app |
| `frontend/` | Separate React/Vite desktop UI; CodeMirror and Tauri plugins |
| `src-tauri/` | Tauri 2 / Rust native file access, extraction and translation commands |
| `collaboration-server/` | Node HTTP/WebSocket backend, auth, projects, Admin, email, native Radio media |
| `packages/core/` | File parsers/export, project format, token profiles, extraction, QA and workflow logic |
| `packages/i18n/` | Shared English/Arabic catalogue, provider, direction and language selector |
| `tests/e2e/` | Playwright Chromium/WebKit desktop/mobile regression suites |
| `website/tests/`, source `*.test.*` | Vitest structural, logic and component tests |
| `collaboration-server/tests/` | Node tests, including isolated PGlite lifecycle coverage |
| `afterhours_gateway.py` | Separate AFTERHOURS Telegram/listening gateway; not LH Radio |

No repository `AGENTS.md` was found. Do not use unrelated instructions from sibling repositories.

## 2. GitHub repo map

- Remote: `https://github.com/dedwrite/LocalizationHub`.
- GitHub CLI confirms visibility **PRIVATE**, default branch `main`.
- Initial local main `f7ca82d` was clean. Fetch found one newer user commit, `09478fb` (AFTERHOURS gateway changes). Safely fast-forwarded; no local work overwritten.
- Redesign branch: `design/full-product-redesign`, based on `09478fb`.
- Current version remains `0.9.8`; no release/tag changes planned.
- Recent main deliberately removed the Konami game-secret interaction. Do not resurrect it from historical context. Preserve currently existing behavior, not every historic feature.
- No `.github/workflows/` directory was found in this checkout. Do not claim a CI release gate exists.

## 3. Render service map

Confirmed workspace: `dedwrite`, `tea-da5ar8u417fc73eqg6e0`.

| Resource | ID | Purpose / source |
| --- | --- | --- |
| localizationhub-relay | srv-da5b5sjm8hqs73c33t7g | LocalizationHub public site + app shell + Node API/WebSocket, same repo/main |
| localizationhub-db | dpg-da5gdsrm8hqs73ck3bkg-a | Render PostgreSQL, available, Ohio; application uses `pg` |
| afterhours-telegram-gateway | srv-dasneqjncjis73atqmu0 | Separate Python AFTERHOURS gateway, same repo/main, manual deploy |
| afterhours-spotify-sync | crn-das60l0jo6nc73abuaeg | Separate signed AFTERHOURS sync, cron every five minutes, manual deploy |

Main service: build `npm ci && npm run website:build`; predeploy `npm run db:migrate --workspace collaboration-server`; start `npm start --workspace collaboration-server`; `/health`; automatic main deployment; previews disabled. Current public domain `https://localizationhub.app/` returns health 200 and the expected existing application. Render service URL: `https://localizationhub-relay.onrender.com`.

Mapping: local npm workspaces → private GitHub repo/main → localizationhub-relay → localizationhub.app. PostgreSQL is the backend datastore. AFTERHOURS is adjacent infrastructure, not a reason to restyle or redeploy it.

No staging service was identified. Use local preview, not a paid new service. Do not push redesign changes to main: that would deploy automatically and run the configured predeploy migration command.

## 4. Route inventory

Authoritative router: `website/src/App.tsx`; nested application routing in `AppWorkspace.tsx` and `AdminConsole.tsx`.

| Routes | Current implementation |
| --- | --- |
| `/` | `pages/LandingPage.tsx`, long-form interactive public Home |
| `/download` | `pages/InfoPages.tsx`, private Windows tester access, support contact; not public installer |
| `/privacy`, `/terms` | DocumentPage and bilingual legal catalogue |
| `/reference` | ReferenceIndex, existing docs-like public entry |
| `/godot`, `/unreal`, `/unity` | CapabilityPage engine support and boundaries |
| `/formats/json`, `/formats/po` | CapabilityPage structured files and gettext reference |
| `/features/translation-memory` | CapabilityPage local project memory explanation |
| `/app`, `/app/projects` | Authenticated Cloud project list/dashboard |
| `/app/login`, `/app/register` | AuthView sign-in / sign-up |
| `/app/projects/:id` | Real Cloud workspace |
| `/app/local` | Local file/project list and real shared workspace; `?sample=northern-gate` |
| `/app/admin`, `/app/admin/security` | Admin dashboard and step-up authentication |
| `/app/admin/users`, `/app/admin/users/:id` | Admin user list/detail |
| `/app/admin/projects`, `/app/admin/projects/:id` | Admin project list/detail |
| `/app/admin/radio`, `/app/admin/audit` | Radio library operations and audit log |
| `/verify-email?token=…` | Backend-generated verification page, outside React router |
| unmatched public routes | NotFound |

There is no current `/product` or `/docs` route. `/reference` is the actual docs destination. No standalone changelog, billing, plans, notification centre, reset-password, forgot-password or magic-link page was discovered. These are inventory gaps, not redesign authorization to build those features.

## 5. Major components

- Public: SiteChrome Header/Footer, LiveEditorPreview, FormatGuide, RtlShowcase, capability pages, TipCard and existing secret triggers.
- App: AppWorkspace, LocalWorkspace, NewProjectModal, ProjectDeleteDialog, AccountDeleteDialog, ResumeCard, state skeletons and CommandCenter.
- Real workspace: Workspace, EntriesPanel, VirtualList, EditorPanel, Inspector, MobileWorkspace, ProjectOverview, SearchReplace, ConfirmDialog, TokenProfileStatus, MachineTranslationPanel, BrowserCollaboration.
- Some deletion dialogs are imported by the website directly from `frontend/src/`; shared appearance changes can therefore affect desktop.
- Native input/button patterns and separate public/app/Admin CSS coexist. There is no installed Tailwind/shadcn UI foundation to replace them with.
- `WorkspaceTools.tsx` remains in source, but the current routed Workspace composes `workspace/Inspector.tsx`; do not treat every legacy file as a live screen.

## 6. Admin surfaces

`AdminConsole.tsx` owns security, dashboard, users/detail, projects/detail, Radio and audit screens. Includes account/project controls, destructive confirmations, role/security states, Radio upload/edit/publication/analysis and metrics, inline errors and MFA.

Backend `admin.mjs` + `admin-http-errors.mjs`; schema includes admin TOTP enrollments, email challenges, sessions and audit log. Step-up email OTP → existing TOTP → Admin session, including reconfirmation/logout. Preserve useful structured auth errors and never reset/re-enroll while restyling.

No billing controls, feature-flag manager, support-ticket UI or email-preview Admin screen was found. No production Admin login or destructive actions were executed during audit.

## 7. Editor surfaces

Browser Local and Cloud use the same real Workspace, with storage adapters in `workspace/storage.ts`. Local projects use IndexedDB `localizationhub-web-local` / `projects`; core project codec preserves the existing format and context. Cloud projects use backend revisions and permissions.

Existing behavior: virtualized entry list, search/filter/sort, selection/bulk actions, protected source tokens, independent source/target direction, speaker/listener/scene, token profiles, four review statuses, QA, glossary, translation memory, comments, assignments, activity/restore, team roles, collaboration and machine translation. Mobile has an intentional separate Workspace composition.

Preserve save/error/revision states, unsaved-navigation guard, keyboard actions, export and local backup semantics. Home must not import or initialize the authenticated Workspace merely to display an animated demonstration.

## 8. Player surfaces

LH Radio is global lazy-loaded UI in `App.tsx`, hidden on Admin routes. Browser implementation: `website/src/lhRadio/{LhRadio.tsx,LhRadio.css,lhRadioState.ts,lhRadioProgress.ts}` and `radioApi.ts`. Desktop has a corresponding `frontend/src/lhRadio/` implementation.

Uses HTMLAudioElement and reducer state; public catalogue and media come from `/api/radio/tracks` and track audio/artwork endpoints. Mini capsule and expanded catalogue, play/pause, previous/next, track selection, seek, volume/mute, active track, artwork rotation, capsule perimeter progress, metadata, loading/empty/unavailable/playback error states. Harmless open/volume/mute preferences persist locally. GET/HEAD/Range behavior belongs to backend tests and must remain unchanged.

No distinct recommendation engine, listening-history screen, shuffle or repeat control exists in the inspected LH Radio state/API/UI. Catalogue selection is not a separate recommendation/queue service. AFTERHOURS has separate listening integrations and must not be conflated with LH Radio.

## 9. Auth flows

Custom Node auth (`auth.mjs`), username/email/password registration, hashed password/session handling, login/me/logout. Browser `appApi.ts`; desktop `authApi.ts` / AuthPanel. Email verification send/resend/verify, cooldown/expiry and backend success/error page. Owner/editor/viewer project membership enforcement; direct member addition rather than a discovered email invite-acceptance system. Account deletion is already implemented and has tests.

No Supabase auth, password reset sender, magic link or third-party identity provider was found. Do not change session transport, permission semantics or verification requirements for visual work.

## 10. Email templates / provider

`collaboration-server/email-delivery.mjs` calls Resend. Two exported senders:

1. `sendVerificationEmail`: verification link, username, expiry, HTML table layout, text fallback, escaped values, idempotency key.
2. `sendAdminAccessCodeEmail`: single-use six-digit OTP, approximately five minutes, text fallback plus minimal paragraph HTML.

Verification URL is configured and processed by backend `/verify-email`; current template wording is English. No welcome, password-reset, project-invite, review-request or account-change email template was discovered. Later email migration must preserve delivery contracts, escaping, idempotency and text fallback, add locale-aware direction deliberately, and use robust email CSS. No real message was sent.

## 11. Desktop app surfaces

`frontend/src/App.tsx`: shell, local/recent/Cloud projects, file opening/import/save/export, translation editor, inspector, workflow, collaboration, auth and extraction panels/review dialogs. Tauri native plugins: filesystem, dialog, opener, persisted scopes and debug logging.

`src-tauri/src/lib.rs` registers directory scanning, authorized extraction roots, batched text/binary reads, copy, external helpers, temp jobs and Google/Gemini/DeepL translation commands. Helpers and engine parsers have intentional support boundaries. Native OS dialogs cannot be arbitrarily restyled as web modals. No independent updater UI/plugin was found in inspected manifests/command list; do not advertise one as present.

## 12. Current design system / CSS approach

Current public theme is scoped `#public-site`, with self-hosted Schibsted/Noto fonts and ink/violet roles. Application colours were recently centralized in `app-palette.css` with tests rejecting arbitrary palette declarations elsewhere. Admin has its own stylesheet, Radio another, desktop separate component CSS.

App.tsx imports base, palette, experience, workspace, refinement, delight and public sheets. Many overlapping legacy selectors remain. Public colour tokens are not a shared ecosystem system. Existing DESIGN.md and `.impeccable/design.json` describe the previous public identity, not V3.

Visual risks: cascade coupling, component-specific radii, distinct focus/dialog/loading conventions and large operational files. Introduce opt-in semantic foundations rather than a global palette replacement. Preserve the palette guard and document deliberate future migration boundaries.

## 13. Current motion / animation libraries

No Framer Motion, Motion, GSAP or anime dependency was found in root/website/frontend manifests. Existing CSS transitions/keyframes, React state/effects and browser animation APIs are sufficient. Radio already has artwork/progress mechanisms; no reason to rewrite audio logic.

V3 motion: select → Arabic RTL reveal → validate → reset. Product frames illustrate additional future motion, not a reason to implement Phase 3 now. Avoid timer-per-character typing and constant screen-reader announcements. Pause automatic motion on interaction, hidden tab/offscreen and reduced motion; include explicit pause/replay.

## 14. RTL implementation

Shared I18nProvider persists EN/AR preference, updates html lang/dir, restores stored preference after prerender hydration and supports legacy UI-string localization. New components should use explicit catalogue keys and skip legacy mutation of controlled localized content.

Shared CSS isolates technical code, keys and explicit direction containers. Source/target fields own their direction independently. Mixed Arabic placeholders need `bdi` or isolated LTR spans. Native Radio transport remains the same physical previous/play/next order. Motion follows Arabic reading direction, not merely text alignment. No parser/source data should be modified to fix visual bidi.

## 15. Risks and unresolved decisions

1. **Private GitHub vs Figma GitHub link:** current site intentionally avoids repo/release URLs. Do not expose a fake public destination or change repo visibility. Proposal: retain GitHub action clearly labelled private access, subject to user decision.
2. **Download truth:** route must remain private tester access; no invented public installer.
3. **Home compression without feature loss:** relocate the current long-form Landing to `/product` as an interim existing-content destination. Do not implement Product Details redesign/animations yet. Preserve old fragment deep links through redirect/alias mapping.
4. **Existing secrets/tips:** relocate their existing presentation with long-form content; retain global command centre/Radio. Do not restore deliberately removed Konami behavior.
5. **Figma page-list inconsistency:** page list returns only Page 1, but explicit approved frames return correct names and rendered content. Use supplied V3 IDs; do not import historical explorations.
6. **Figma contrast:** #383d3b on #070808 is too low for functional labels. Preserve its decorative role only; accessible role variants must be measured.
7. **Figma counts/content:** 32-string frame is illustrative; do not claim the real Northern Gate sample has 32 entries (existing sample is 24). Match count to the actual demonstration data or label it an illustrative excerpt.
8. **CSS/data coupling:** opt-in foundations, no global editor/Admin/Radio change. Keep local IndexedDB names/records, APIs, parser behavior and Tauri permissions untouched.
9. **Deployment:** main auto-deploys and invokes predeploy migrations. Redesign stays local until reviewed; no Render plan/secrets/domain/start-command changes.
10. **Coverage:** audit is source + public/browser + service metadata, not exhaustive authenticated production human testing. Later milestones require state-specific regression and native verification.

## 16. Phase 1 foundations plan

Recommended approach: opt-in shared system, progressively adopted. Alternatives rejected: global token alias swap (fast but changes unreviewed screens), new UI-framework rewrite (large risk, unnecessary).

- Establish a small workspace shared UI package: semantic CSS tokens, font roles, spacing, radius, layers, focus and motion contracts. Keep tokens scoped to a theme boundary, not :root activation on all apps.
- Start only with primitives Home genuinely consumes: Button/LinkButton, IconButton, Badge/Status, field/focus conventions and language selector integration. Extend later when real consumer routes migrate; no 40 unused abstractions.
- Preserve native HTML semantics, ref/aria/disabled behavior, logical CSS properties, independent text direction, 44px coarse-pointer targets and contrast requirements.
- Motion durations: micro 140ms, standard 240ms, functional 400ms, story 600ms; shared easing, no bounce. Respect reduced motion in CSS and state controller.
- Existing Inter reference must be resolved with a licensed local asset; Noto Arabic remains compatible. Do not add remote font dependence or animation libraries automatically.
- Add token isolation, primitive semantics and reduced-motion unit tests before implementation; keep app palette guard passing.
- Coherent local commits for foundations and motion, without backend/schema/package-version changes.

## 17. Phase 2 Home plan

- Follow V3 approved frames 8:3 / 8:83 / 8:163 closely: compact header, brief intro, action rail, dominant real DOM editor demonstration, minimal footer. No feature tower below Home.
- Separate existing long-form Landing content at `/product` as an interim preservation step; map old anchor links and keep public prerender, metadata, canonical and sitemap consistent. Product Details redesign is deferred.
- Use current navigation, locale catalogue and core token validation rather than new mock backend/auth. Demo is clearly illustrative, with selectable strings, editable translation, explicit validate/reset and pause/replay; no private project reads, uploads or persistence writes.
- Auto story cannot overwrite a focused/edited translation. Validate actual tokens via existing core scanner. Announce manual results; do not announce every automatic cycle.
- RTL UI follows locale; source EN stays LTR, Arabic target true RTL, placeholder isolation. Arabic reveal originates physically from right. Do not mirror code or the audio transport.
- Wide 1440 layout uses ~64px gutters, 270px rail and flexible editor. Laptop/tablet compact rail. Phones replace rail with usable selector; keep source/translation/validation readable rather than scaling desktop UI.
- Asset policy: download and locally bundle provided Figma SVG assets using the instructed workflow; preserve their intended slots and intrinsic dimensions. No screenshot-as-UI.
- Actual destinations: `/app/local`, `/product`, `/reference`, `/download`; GitHub private access decision remains explicit.
- Gates: website build, i18n audit, Vitest foundations/core/i18n/public tests, Home Playwright desktop/laptop/tablet/360/390/430 EN/AR/real WebKit, keyboard/axe, reduced motion, hidden-tab pause, interaction takeover, token error/reset, SSR/no-JS links, old deep links, app/Admin/Radio regression smoke and `git diff --check`.
- Capture desktop/mobile EN/AR screenshots and report actual counts, files and commits. Stop for human Home review; no push to main, deployment, release/tag or later-surface migration.
