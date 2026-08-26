# LocalizationHub

LocalizationHub is a local-first localization workspace for game translation projects and collaborative translation teams.

It combines a structured desktop editor with optional Cloud Projects, account-based collaboration, protected-token validation, lossless localization workflows, and machine translation reference tools.

## Current Release

**LocalizationHub v0.6.0 - Web App & Mobile Translation**

Version 0.6 adds browser translation, responsive mobile/tablet workflows, browser-local formats, and Cloud collaboration while preserving the local-first workflow. A private Super Admin security console is available only through server-authoritative email and TOTP step-up authentication.

## v0.6.0 Web App & Mobile Translation

LocalizationHub v0.6.0 provides **Web App & Mobile Translation**: browser Cloud Projects, responsive desktop/tablet/phone editing, browser-local JSON/CSV/PO workflows, workflow and quality tools, team collaboration, browser recovery through IndexedDB, and a private Super Admin security console.

## What's New in v0.5.0

LocalizationHub v0.5.0, **Website & Launch Experience**, moves the project from a working desktop/cloud application into a publicly launched product with an official website, production deployment, release distribution, and end-to-end validation.

### Public Website & Release Experience

- Official public website for LocalizationHub.
- Dedicated **Home**, **Download**, **Privacy**, and **Terms** pages.
- Public email-verification experience integrated with the launched service.
- Release-aware download presentation for the current Windows build.
- Product branding and release metadata aligned with v0.5.0.
- Polished motion, reveal effects, pointer-depth interaction, and responsive presentation.
- Direct access to the current GitHub Release and Windows installer.

### Production Launch

- Public website and production backend launched together under the official LocalizationHub domain.
- Same-origin website serving while preserving backend API, health, verification, and real-time collaboration routes.
- Existing desktop collaboration compatibility preserved during the launch transition.
- Production database migrations verified before release.
- Cloud API enabled and validated in the production environment.
- Website and backend startup behavior validated for a production deployment.

### Accounts, Cloud Projects, and Email Verification

The v0.5 launch also validates the existing Cloud foundation as a complete public workflow:

- Account registration, login, sessions, and logout behavior verified.
- Real email verification delivery and verification-link flow validated end to end.
- Verified-account gating for Cloud features confirmed.
- Cloud Project creation, loading, updates, persistence, and revision-conflict handling verified.
- Owner, Editor, and Viewer permissions validated against the live Cloud workflow.
- Membership changes and read/write restrictions verified server-side.
- Existing workflow metadata, assignments, comments, history, restore, review, and quality data validated against persistent Cloud storage.

### Real-Time Collaboration Validation

- Cloud WebSocket collaboration validated in a hosted environment.
- Real-time translation updates verified between authenticated collaborators.
- Session revision handling and synchronization verified.
- Reconnect behavior validated.
- Live role and membership enforcement confirmed.
- Existing collaboration security rules preserved through the website/production launch.

### Release Reliability

- Full staging validation completed before production cutover.
- Production smoke checks completed for the website, download flow, health endpoint, verification page, Cloud API authentication boundary, and collaboration compatibility.
- Windows x64 installer built and published for v0.5.0.
- SHA-256 checksum published alongside the installer.
- Git tag and GitHub Release published from the verified release commit.
- Post-release cleanup completed after production validation.

No credentials, private deployment values, database connection details, API keys, or other operational secrets are included in the public release documentation.

## What's New in v0.4.0

LocalizationHub v0.4.0, **Translation Workflow & Quality**, turns the editor into a practical translation workspace for local and Cloud Projects.

- Review-ready workflow statuses: **Draft**, **Translated**, **Needs Review**, and **Approved**.
- Project V3 workflow metadata with migration support for older project files.
- Project tags, advanced search and filtering, and efficient bulk operations.
- Project glossaries with terminology guidance and Translation Memory suggestions.
- Project statistics for translation progress, review progress, and word counts.
- CSV and gettext PO import/export alongside existing JSON support.
- Cloud assignments, entry comments, activity/history, translation restore, and manual conflict review.
- Owner, Editor, and Viewer collaboration permissions with persistent Cloud workflow data.
- Safer Cloud Projects with consistent assignment cleanup when members leave and stricter project validation.
- A redesigned translation workspace with contextual Workflow, Quality, Comments, and History inspection.

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
- Opening CSV and gettext PO localization files.
- Automatically analyzing supported JSON structures.
- Detecting translatable source and translation fields.
- Editing entries in a structured workspace.
- Preserving keys, IDs, metadata, and source structure.
- Preserving large numeric values without precision loss.
- Search and filtering.
- Workflow status, project tags, glossary guidance, and Translation Memory suggestions.
- Bulk workflow operations and project statistics.
- Entry comments, assignments, activity history, restore, and conflict review in Cloud Projects.
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

Accounts are backed by PostgreSQL.

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

LocalizationHub continues persistent Cloud Projects with translation workflow and quality collaboration tools.

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

The current release builds on the authenticated production collaboration architecture introduced in v0.3.

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

LocalizationHub separates reusable localization logic from the desktop UI through the `@localizationhub/core` package.

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

### Version 0.5.0 - Website & Launch Experience

LocalizationHub v0.5.0 launches the official public website and release/download experience, introduces same-origin website serving alongside the existing backend, validates accounts, email verification, Cloud Projects, workflow persistence, permissions, and real-time collaboration in hosted environments, and ships a verified Windows x64 installer with a published SHA-256 checksum.

### Version 0.4.0 - Translation Workflow & Quality

LocalizationHub v0.4.0 adds the complete translation workflow and quality layer: persistent V3 workflow metadata, review statuses, tags, advanced filtering, bulk operations, glossary and Translation Memory guidance, project statistics, CSV/PO support, Cloud assignments and comments, activity history, translation restore, manual conflict review, and the redesigned contextual inspector workspace.

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

## Roadmap - Beyond v0.5

Potential areas include:

- Expanded Godot localization workflows.
- Unreal Engine localization workflows.
- Git integration.
- Expanded Cloud project management.
- Web client development and eventual desktop/web feature parity.
- Additional collaboration administration and moderation tools.

Game extraction and injection, archive decryption/repacking, and executable modification remain outside the current product scope.

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

**LocalizationHub v0.6.0**

Windows builds are distributed through the project's GitHub Releases page.

Download the current release: [LocalizationHub v0.6.0 on GitHub](https://github.com/dedwrite/LocalizationHub/releases/tag/v0.6.0).
