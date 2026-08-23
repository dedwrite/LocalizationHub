# LocalizationHub

LocalizationHub is a local-first desktop localization workspace designed for game translation projects and collaborative translation teams.

It provides a structured environment for importing localization files, editing translations safely, preserving game-specific metadata, validating protected tokens, and collaborating with other translators in real time.

## Current Release

**LocalizationHub v0.2.0**

The current release focuses on a stable desktop localization workflow with optional real-time collaboration and machine translation reference tools.

## Goals

LocalizationHub aims to make working with localization files easier, safer, and more collaborative.

The project is designed around several principles:

- Preserve the original structure of localization files.
- Protect IDs, variables, placeholders, tags, and metadata.
- Keep translators focused on translatable text.
- Support both left-to-right and right-to-left languages.
- Keep local projects usable without requiring cloud services.
- Make collaboration optional rather than mandatory.
- Provide machine translation as a reference, not as an automatic replacement for human translation.

## Localization Editor

LocalizationHub currently supports:

- Opening JSON localization files.
- Automatically analyzing supported JSON structures.
- Detecting translatable source and translation fields.
- Editing source and translation entries in a structured workspace.
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

## Machine Translation Reference

LocalizationHub includes an optional Machine Translation Reference panel.

Supported providers currently include:

- Google Gemini
- Google Cloud Translation
- DeepL

Machine translation is intentionally separated from the actual translation editor.

LocalizationHub does **not** automatically overwrite or fill translation entries with machine-generated text.

API keys are kept in application memory only and are not stored in:

- `.lhproj` files
- Localization files
- Application configuration
- Local storage
- Logs

This keeps machine translation optional while leaving the human translator fully in control.

## Real-Time Collaboration

LocalizationHub v0.2 introduces real-time collaborative translation sessions.

A user can host a collaboration session and other translators can join using a session ID.

Current collaboration features include:

- Host and Guest sessions.
- Automatic project synchronization when a Guest joins.
- Real-time translation synchronization.
- Server-authoritative translation revisions.
- Conflict detection for simultaneous edits.
- Conflict review with **Keep Mine** and **Keep Theirs** resolution.
- Participant presence.
- Current-entry indicators.
- Jump-to-entry navigation by clicking another participant.
- Collaboration participant and status popover.
- Automatic reconnection after temporary connection loss.
- Session resume using in-memory reconnect credentials.
- Relay heartbeat handling for stale WebSocket connections.

Collaboration is optional. Local editing continues to work independently of the collaboration system.

### Collaboration Relay

Real-time collaboration currently uses the LocalizationHub Collaboration Relay.

During local development the default relay address is:

    ws://127.0.0.1:8787

The relay is currently intended for development and controlled environments.

Public Internet collaboration will require production deployment using secure WebSockets (`wss://`) and additional authentication and security work.

## Supported Localization Structures

The parser currently supports JSON-based localization structures including:

- Flat localization objects.
- Record-array localization files.
- Configurable source and translation paths.
- Structured metadata that must survive round-trip export.

LocalizationHub projects store parser information so saved projects can reopen with the same localization structure.

Additional localization formats are planned for future releases.

## Local-First Design

LocalizationHub is designed to remain useful without an account or cloud connection.

Core project files and translations remain on the user's machine unless the user explicitly chooses to participate in a collaboration session or use an external machine translation provider.

## Version 0.1

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

## Version 0.2

Version 0.2 expanded LocalizationHub from a local editor into a collaborative localization workspace.

Major additions include:

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
- Automatic collaboration reconnect and session resume.
- WebSocket heartbeat handling.
- Additional workspace and workflow polish.

## Roadmap

Future development may include:

- Production-hosted secure collaboration using `wss://`.
- Collaboration authentication and invitations.
- Session permissions and host controls.
- Translation Memory.
- Glossaries and terminology management.
- Comments and review workflows.
- Translation history and revision inspection.
- Project statistics and reporting.
- Additional localization file formats.
- Additional Godot localization support.
- Unreal Engine localization workflows.
- Git integration.
- Web or mobile companion clients.

Game extraction and injection features may be explored separately, but they are not part of the current core localization workflow.

## Development Philosophy

Build the localization core first.

Preserve user data and file structure before adding automation.

Keep machine-generated translation advisory rather than authoritative.

Make collaboration useful without making cloud services mandatory.

Add game-specific tooling only when the underlying localization workflow is stable.

## Platform

LocalizationHub is currently developed and released primarily as a Windows desktop application using:

- Tauri
- Rust
- React
- TypeScript

## Release

The latest release is:

**LocalizationHub v0.2.0**

Windows builds are distributed through the project's GitHub Releases page.
