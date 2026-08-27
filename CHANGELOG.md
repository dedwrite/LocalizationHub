# Changelog

All notable LocalizationHub release milestones are documented here.

## [0.6.1] - 2026-08-26

### Web Workspace Parity & Translator Experience

- Desktop-parity three-pane Web Workspace (Entries / Translator / Inspector) with resizable and collapsible panels, focus mode, and locally persisted layout.
- Overhauled Inspector with Workflow, Quality, Comments, Assignments, History, Tags, Translation Memory, and Glossary tabs — no horizontal tab scrolling.
- Machine Translation Reference panel on Web (Gemini / Google AI Studio) with session-only API keys that are never persisted or sent to the backend.
- Entry list parity: status/QA/comment/assignment indicators, counts, search, filters, checkbox bulk selection, and bulk workflow actions.
- Protected-token inline validation and Token Profile selection using shared core logic.
- Translator-grade Search & Replace with Replace All confirmation, and Jump to Entry.
- Project Overview, workspace toolbar, save states (Saved / Unsaved / Saving / Failed), and debounced autosave for Cloud Projects.
- Keyboard workflow: Ctrl+S save, Ctrl+Enter commit-and-advance, Alt+Down/Up navigation, Ctrl+F search, Escape dismiss.
- Windowed list virtualization for large projects (10k+ entries).
- Branded New Project modal (import JSON/CSV/PO) and polished Projects page with progress and search — no native browser dialogs.
- Responsive layouts for 360–1920px with no horizontal document overflow; Viewer read-only enforced.

### Mobile Workspace Redesign

- Dedicated phone workspace with a bottom navigation of **Entries**, **Editor**, and **Tools** — no more desktop panels stacked vertically.
- Touch-first editor: comfortable auto-growing translation field, source card with copy, compact workflow status buttons, and Previous / Next / Next Untranslated navigation.
- Compact entries screen with a progress summary, search, primary filter chips plus "More filters", and a dedicated selection mode for bulk actions.
- Mobile Tools surface hosting the full Inspector plus Project Overview, Search & Replace, and Collaboration, without crowding the editor.
- Simplified mobile Projects page and a purposeful Cloud / Local switcher.
- iPhone Safari behavior: 16px inputs (no auto-zoom), dynamic-viewport and safe-area handling, RTL/LTR-aware editing, and no controls hidden behind browser chrome.
- WebKit (Safari) Playwright coverage kept permanently alongside Chromium — Chromium viewport emulation is no longer treated as Safari acceptance.

## [0.6.0] - 2026-08-26

### Web App & Mobile Translation

- Browser Cloud Project workspace with responsive translation editing.
- Search, workflow, quality warnings, statistics, comments, assignments, history, restore, team tools, and collaboration controls.
- Browser-local JSON, CSV, and gettext PO import/export with IndexedDB recovery.
- Installable web app manifest and mobile/tablet layout work.

### Admin Console

- Multi-factor Admin authentication: email code + TOTP with Google Authenticator.
- Dashboard: real-time platform metrics (users, projects, sessions, storage).
- Users Management: list, search, view detail, suspend/unsuspend, verify email, revoke sessions, delete with cascade options.
- Projects Management: list, search, view detail, delete with data cascade, member roles, ownership transfer.
- Storage Accounting: platform-wide and per-user storage breakdown.
- Session Management: list active sessions per user, revoke individual or all sessions.
- Audit Log: complete admin operation history.
- Security: sensitive operations require additional confirmation; all administrative activity is audited.

## [0.5.0] - 2026-08-26

### Website & Launch Experience

- Public website with release, download, privacy, and terms pages.
- Same-host website gateway preserving backend, API, verification, and WebSocket route ownership.
- Approved website motion and launch experience for the v0.5.0 release.

## [0.4.0] - 2026-08-25

### Translation Workflow & Quality

- Project V3 workflow metadata with migration from V1/V2 projects.
- Draft, Translated, Needs Review, and Approved workflow states with persistence.
- Project tags, advanced search, bulk operations, glossary, and Translation Memory.
- Project statistics, CSV support, and gettext PO support.
- Cloud assignments, comments, history/activity, translation restore, and manual conflict review.
- Owner, Editor, and Viewer enforcement with real PostgreSQL-backed workflow persistence.
- Assignment cleanup when project membership is revoked.
- Cloud V3 trust-boundary validation and the permanent real PostgreSQL v0.4 E2E release gate.
- UI/UX redesign for a focused translation workspace with contextual inspection tools.

### Fixed

- Corrected PostgreSQL UUID typing for comment resolution and strengthened workflow reliability checks.

Game extraction/injection, archive handling, repacking, and executable modification remain outside this release scope.

## [0.3.0] - 2026-08-24

### Added

- Shared `@localizationhub/core` package and project storage abstraction.
- Production-hosted collaboration relay support.
- PostgreSQL database foundation and migration system.
- Persistent account authentication and server-side sessions.
- Email verification tokens, delivery, and verification UI.
- Persistent Cloud Projects.
- Cloud project ownership and account-based access control.
- Owner, Editor, and Viewer project roles.
- Cloud project membership management API and UI.
- Custom application confirmation dialogs.
- One-time WebSocket authentication tickets.
- Cloud-aware collaboration hosting and joining.
- Live membership role updates and revocation.
- Automated Cloud collaboration security smoke tests.

### Changed

- Cloud Projects now require appropriate authenticated and verified access.
- Viewer Cloud workspaces are read-only in the UI and collaboration layer.
- Cloud mutation permissions are revalidated by the server.
- Cloud reconnects revalidate current PostgreSQL membership.
- Collaboration reconnect grace increased from 15 to 30 seconds.
- Valid authenticated Cloud reconnects can replace stale sockets still reported as open.
- Collaboration security no longer exposes account session tokens through WebSocket URLs.

### Fixed

- Membership mutation CORS support.
- Cloud project error handling and loading states.
- Cloud reconnect behavior behind production proxies.
- Cross-account session-resume protection.
- Stale-socket resume failures observed in production.

### Validation

The complete Cloud collaboration security smoke suite passed locally and against the production relay before this release was closed.

## [0.2.0]

### Added

- Machine Translation Reference.
- Gemini, Google Cloud Translation, and DeepL integrations.
- Real-time collaboration.
- Project synchronization.
- Live translation synchronization.
- Conflict detection and resolution.
- Participant presence and navigation.
- Automatic collaboration reconnect.
- WebSocket heartbeat handling.

## [0.1.0]

### Added

- Initial Windows desktop localization editor.
- JSON parsing and structured translation editing.
- Lossless export.
- Protected-token validation.
- RTL/LTR editing.
- Local `.lhproj` projects.
- Search, filtering, save, and export workflows.
