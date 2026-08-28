# Changelog

All notable LocalizationHub release milestones are documented here.

## [0.7.0] - 2026-08-28

### Added

- **Game Text Extraction** — point LocalizationHub at a supported game project folder, scan it read-only, review the discovered text, and create a LocalizationHub Project.
- **Godot** — `.pck` extraction (GDRE-assisted), native CSV/PO/`.tscn`/`.tres`/`.gd` parsing, JSON database locale aggregation, and native `.inkb` story dialogue with speaker resolution and timed player-Choice extraction.
- **Unreal** — native `.locres`/`.locmeta` readers, verified PAK (repak) and IoStore (retoc) orchestration, an optional user-supplied AES key for encrypted archives, and runtime-vs-engine precision filtering.
- **Unity** — UnityPy-assisted serialized-asset extraction, TextAsset routing, MonoBehaviour/ScriptableObject structured extraction, Unity Localization string tables, and Dialogue System (`MasterDialogueDatabase`) support.
- **Extraction Review** — virtualized entries, a searchable Sources panel, a Diagnostics panel, Context Mapping (including an Ignore role), locale/source switching, filters, and Create Project.
- **Generic Open File context** — opening JSON/CSV/PO preserves speaker, listener, gender, pronouns, scene/conversation, multiple listeners, voice, and portrait when explicitly present.

### Changed

- Proven editor/developer/test tooling is excluded from the default extracted project (with a visible reason), while uncertain and runtime content stays included.
- Multi-language game files aggregate into logical entries with locale variants instead of one duplicate per culture.

### Notes

- All extraction is read-only: source game files are never modified.
- Some deep binary formats remain partial or external-tool-required; see `docs/dev/v0.7-engine-compatibility.md` for the honest per-format status.

## [0.6.1] - 2026-08-27

### Added

- Desktop-parity three-pane Web Workspace (Entries / Translator / Inspector) with resizable and collapsible panels, focus mode, and locally persisted layout.
- Overhauled Inspector with Workflow, Quality, Comments, Assignments, History, Tags, Translation Memory, and Glossary tabs — no horizontal tab scrolling.
- Machine Translation Reference panel on Web (Gemini / Google AI Studio) with Gemini 3.5 Flash-Lite (fastest, default), Gemini 3.6 Flash (balanced), and Gemini 3.7 Flash (quality), plus a lower-latency thinking configuration.
- Translator-grade Search & Replace with Replace All confirmation, and Jump to Entry.
- Project Overview, workspace toolbar, save states (Saved / Unsaved / Saving / Failed), and debounced autosave for Cloud Projects.
- Branded New Project modal (import JSON/CSV/PO) and a polished Projects page with progress and search — no native browser dialogs.
- Dedicated mobile workspace with Entries / Editor / Tools bottom navigation and a touch-first editor.

### Changed

- Entry list brought to desktop parity: status/QA/comment/assignment indicators, counts, search, filters, checkbox bulk selection, and bulk workflow actions.
- Responsive layouts for 360–1920px with no horizontal document overflow; Viewer read-only enforced.

### Fixed

- Resolved a production crash where opening the Web App with no valid session showed "Workspace unavailable" instead of Login.
- Hardened browser auth restoration so corrupt or stale local storage never breaks startup.
- Improved the error boundary to surface real diagnostics in development while keeping a friendly fallback in production.
- Stopped Chrome credential autofill from hijacking the Machine Translation API key field (visually masked text input with Show / Hide).
- Fixed a stale Gemini model reference; the web Machine Translation now uses supported current models.
- Corrected draft update resolution so saves always serialize a valid project object rather than a stale closure.
- Corrected the Windows installer to embed the production Cloud API and collaboration endpoints; a release build now fails fast if that configuration is missing.

### Build & release

- Centralized desktop endpoint resolution in `runtimeConfig` and added a committed non-secret `.env.production` so a release installer is Cloud-enabled without manual environment setup.
- Added a production-config validation gate to the release build and a production-build regression test that verifies the compiled bundle embeds the intended endpoints.

### Compatibility

- Legacy Cloud Projects (Project V1/V2) open and migrate in memory to the current Project V3 format on next save.
- Desktop / Web interoperability preserved through the shared `@localizationhub/core` parser, workflow, and protected-token logic.

### Performance

- Windowed list virtualization keeps the entry list smooth for projects with 10,000+ entries.
- Lower-latency Gemini thinking configuration returns translations more quickly.

### Mobile

- Dedicated phone workspace — no more desktop panels stacked vertically.
- Touch-first editor: auto-growing translation field, source card with copy, compact workflow buttons, and Previous / Next / Next Untranslated navigation.
- Compact entries screen: progress summary, search, primary filter chips plus "More filters", and a dedicated selection mode.
- Mobile Tools surface hosting the full Inspector plus Project Overview, Search & Replace, and Collaboration.
- Simplified mobile Projects page and a purposeful Cloud / Local switcher.

### Privacy

- Machine Translation API keys are held in browser memory only and are never persisted, logged, or sent to the LocalizationHub backend.
- No project contents, credentials, or session tokens are exposed by error reporting.

### Testing

- Permanent WebKit (Safari) Playwright coverage added alongside Chromium — Chromium viewport emulation is no longer reported as Safari acceptance.
- Added a Safari boot regression suite (clean, corrupt-storage, and expired-session startup) and a mobile workflow suite covering the full phone translation flow, RTL, touch targets, and the phone overflow matrix.

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
