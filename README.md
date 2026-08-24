# LocalizationHub

LocalizationHub is a local-first localization workspace for game translation projects and collaborative translation teams.

It combines a structured desktop editor with optional Cloud Projects, account-based collaboration, protected-token validation, lossless localization workflows, and machine translation reference tools.

## Current Release

**LocalizationHub v0.3.0 - Cloud Foundation & Secure Collaboration**

Version 0.3 establishes the account, cloud storage, project membership, and production collaboration foundation while preserving the local-first workflow introduced in earlier releases.

## Core Principles

LocalizationHub is built around a few rules:

- Preserve the original structure of localization files.
- Protect IDs, variables, placeholders, tags, and metadata.
- Keep translators focused on translatable text.
- Support both left-to-right and right-to-left languages.
- Keep local projects usable without requiring an account or cloud connection.
- Make Cloud Projects and collaboration optional.
- Keep machine translation advisory rather than authoritative.
- Prefer safe, explicit project operations over hidden automation.

## Localization Editor

LocalizationHub currently supports:

- Opening JSON localization files.
- Automatically analyzing supported JSON structures.
- Detecting translatable source and translation fields.
- Editing entries in a structured workspace.
- Preserving keys, IDs, metadata, and source structure.
- Preserving large numeric values without precision loss.
- Search and filtering.
- Translation progress tracking.
- Protected token detection and validation.
- Generic and Godot-oriented token profiles.
- Validation warnings and error filtering.
- Bidirectional editing for LTR and RTL languages.
- Local project files using the `.lhproj` format.
- Recent projects and last-session recovery.
- Drag-and-drop file opening.
- Quick Save and Save As workflows.
- Safe export back into the original localization structure.

## Local-First Projects

Local projects remain fully usable without an account or cloud connection.

LocalizationHub does not require translators to upload ordinary local projects to a server.

A project only uses cloud infrastructure when the user explicitly chooses a Cloud Project or an online collaboration feature.

## Accounts and Email Verification

Version 0.3 adds persistent accounts backed by PostgreSQL.

Current account functionality includes:

- Username and password authentication.
- Persistent server-side sessions.
- Secure password hashing.
- Hashed session-token storage.
- Email verification.
- Branded verification emails.
- Verification UI and verification links.
- Cloud features gated behind verified accounts where appropriate.

## Cloud Projects

LocalizationHub v0.3 introduces persistent Cloud Projects.

Cloud Projects provide:

- PostgreSQL-backed project storage.
- Project ownership.
- Cloud project creation and loading.
- Server-side revision handling.
- Conflict-aware saves.
- Account-based access control.
- Automatic loading in supported development and production workflows.

Cloud Projects are separate from local `.lhproj` projects. Local editing remains available independently.

## Project Roles and Team Management

Cloud Projects support three roles:

- **Owner** - full project ownership, editing, and membership management.
- **Editor** - can read and modify the project.
- **Viewer** - read-only access.

Owners can:

- Add members by username.
- Change Editor and Viewer roles.
- Remove members.

Viewer restrictions are enforced in both the desktop workspace and the server-side collaboration layer.

Role changes and membership removals can also propagate live to active collaboration sessions.

## Secure Real-Time Collaboration

LocalizationHub includes real-time collaborative translation sessions.

Version 0.3 moves collaboration from a development-oriented relay toward an authenticated production architecture.

Current collaboration features include:

- Local anonymous collaboration sessions.
- Cloud collaboration tied to project permissions.
- Host and participant sessions.
- Automatic project synchronization.
- Real-time translation synchronization.
- Server-authoritative translation revisions.
- Conflict detection for simultaneous edits.
- Conflict review with **Keep Mine** and **Keep Theirs** resolution.
- Participant presence.
- Current-entry indicators.
- Jump-to-entry participant navigation.
- Collaboration status and participant controls.
- Heartbeat handling.
- Automatic reconnect and session resume.

### Collaboration Security

Production Cloud collaboration now includes:

- Short-lived one-time WebSocket authentication tickets.
- No account session token placed in the WebSocket URL.
- Cloud sessions bound to authenticated users.
- Project role checks before hosting or joining.
- Server-side permission checks before Cloud mutations.
- Live membership and role enforcement.
- Cross-account reconnect protection.
- Membership revalidation during reconnect.
- Secure same-account session resume.
- Stale WebSocket replacement for real-world proxy and network disconnect behavior.

Cloud collaboration permissions are enforced by the server rather than trusted to the client alone.

## Machine Translation Reference

LocalizationHub includes an optional Machine Translation Reference panel.

Supported providers currently include:

- Google Gemini
- Google Cloud Translation
- DeepL

Machine translation is intentionally separated from the translation editor and does not automatically overwrite human translations.

API keys are kept in application memory only and are not stored in:

- `.lhproj` files
- Localization files
- Application configuration
- Local storage
- Logs

## Shared Localization Core

Version 0.3 begins separating reusable localization logic from the desktop UI through the `@localizationhub/core` package.

The shared core currently includes project models, project storage abstractions, parsers, exporters, protected-token logic, and related validation functionality.

This architecture prepares LocalizationHub for additional clients and workflows without duplicating core localization behavior.

## Supported Localization Structures

The parser currently focuses on JSON-based localization structures including:

- Flat localization objects.
- Record-array localization files.
- Configurable source and translation paths.
- Structured metadata that must survive round-trip export.

LocalizationHub projects preserve parser information so projects can reopen using the same localization structure.

## Version History

### Version 0.3

Version 0.3 establishes the Cloud Foundation & Secure Collaboration milestone.

Major additions include:

- Shared localization core extraction.
- Project storage abstraction.
- Production-hosted collaboration relay support.
- Collaboration invite security improvements.
- PostgreSQL database foundation and migrations.
- Persistent account authentication.
- Email verification.
- Persistent Cloud Projects.
- Cloud project ownership.
- Owner, Editor, and Viewer membership roles.
- Cloud team management UI.
- Custom confirmation dialogs.
- Viewer read-only enforcement.
- One-time WebSocket authentication tickets.
- Live Cloud membership and role changes.
- Server-side Cloud collaboration permissions.
- Secure collaboration reconnect identity checks.
- Production-safe stale-socket session resume.
- Automated Cloud collaboration security smoke testing.

### Version 0.2

Version 0.2 expanded LocalizationHub from a local editor into a collaborative localization workspace.

Major additions included:

- Machine Translation Reference.
- Gemini integration.
- Google Cloud Translation integration.
- DeepL integration.
- Real-time collaboration sessions.
- Project synchronization.
- Live translation synchronization.
- Translation conflict detection and resolution.
- Participant presence.
- Workspace collaboration status.
- Participant entry navigation.
- Automatic collaboration reconnect.
- WebSocket heartbeat handling.
- Additional workspace and workflow polish.

### Version 0.1

Version 0.1 established the local editor foundation.

Major work included:

- JSON localization parsing.
- Structured translation editing.
- Lossless export.
- Protected token validation.
- RTL/LTR editing.
- Local `.lhproj` projects.
- Search and filtering.
- Save and export workflows.
- Windows desktop packaging.

## Roadmap - v0.4 and Beyond

Work deferred from the v0.3 milestone moves forward into v0.4 and later releases.

Potential areas include:

- Translation Memory.
- Glossaries and terminology management.
- Comments and review workflows.
- Translation history and revision inspection.
- Project statistics and reporting.
- Additional localization file formats.
- Expanded Godot localization workflows.
- Unreal Engine localization workflows.
- Game extraction and injection tooling.
- Git integration.
- Expanded Cloud project management.
- Web client development and eventual desktop/web feature parity.
- Additional collaboration administration and moderation tools.

Roadmap items may move between releases as the project evolves.

## Development Philosophy

Build the localization core first.

Preserve user data and file structure before adding automation.

Keep local workflows independent from cloud services.

Keep machine-generated translation advisory rather than authoritative.

Enforce Cloud permissions on the server.

Add game-specific tooling only when the underlying localization workflow is stable.

## Platform

LocalizationHub is currently developed primarily as a Windows desktop application using:

- Tauri
- Rust
- React
- TypeScript
- Node.js
- PostgreSQL

## Release

The latest release is:

**LocalizationHub v0.3.0**

Windows builds are distributed through the project's GitHub Releases page.
