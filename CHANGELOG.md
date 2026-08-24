# Changelog

All notable LocalizationHub release milestones are documented here.

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
