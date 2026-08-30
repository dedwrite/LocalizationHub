# LocalizationHub v0.9.1 Release Candidate — 2026-08-30

## Identity and scope

- Starting main/origin main: `74a272ee9ca01aadd258b5ce2426a02400332694`.
- Branch: `feature/v0.9.1-local-parity-project-delete`.
- Implementation: `4b8a35887b142a5e94b740fd121c185c0b2f7271`.
- Regression/visual closure: `0368938831d6fd081e26d6f6fb7a4f4c1169b414`.
- RC commit: the commit adding this document; the annotated RC tag targets it.
- RC tag: `checkpoint-v0.9.1-release-candidate-2026-08-30`.
- Versions remain 0.9.0 until the subsequent release-preparation step.

Only Local Workspace parity and owner-only Cloud deletion are added. Existing
capsule-perimeter Radio progress, rotating taglines, dialogue-role recognition,
listener inference/genders, lifecycle preservation and stale-Web import guards
remain intact. No new engines, languages, reinjection or v1.0 work is included.

## Shared Local Workspace

Local and Cloud use the same Workspace, EditorPanel, EntriesPanel, Inspector,
Project Overview, token/profile QA and mobile presentation. A small storage
adapter separates IndexedDB persistence from authenticated Cloud persistence.
Capability checks remove Cloud roles, revisions, members, assignments, comments,
history, collaboration and autosave from Local mode rather than faking them.

Local projects use canonical LocalizationProjectV3: original document structure,
entries/translations, dialogueContext, workflow, selection, metadata, tokenProfile,
tokenProfileConfig and engineDetection survive explicit Save/reopen. Raw files
start in Auto with honest unknown detection/Generic fallback; manual overrides
persist. JSON, CSV and PO/POT export through the original-format exporter, never
as an unexpected project wrapper. Fresh imports receive unique browser IDs.

The existing IndexedDB v1 database/store and row keys are retained. Legacy
ParsedLocalizationDocument values normalize in memory without reparsing source
text, losing translations, deleting the old copy, or writing storage on open.
Only explicit Save upgrades the value. Quota/error paths retain the draft and
offer export-backup guidance. Deleting a local copy affects only its browser row.

Local mode opens without an account or auth restoration. Import/edit/workflow/
profile/Save/Export tests observe no project API, upload or hidden synchronization.
MT is the existing explicit provider operation only; its request contains current
text/context, not unrelated entries or the project. Provider keys remain transient.

Keyboard Save/navigation, unsaved route/Back/reload protection, source highlighting,
actionable token QA, workflow states, translated/completion counts, search,
virtualized 10,000-entry lists, original-format export and selected-entry reopening
are covered. Committed keyboard handlers avoid stale pre-render state; queued
explicit saves read the current selection. No Local autosave/upload was introduced.

## Context, language and visual review

Caloy (male) → Mark (male), Sofia (female) → KuyaGrab (male), explicit multiple
listeners/genders and scene survive canonical Local, Cloud Web and Desktop
serialization. UI and MT consume canonical context, with no JSX role inference.

English/Arabic catalog parity, root RTL, independently directed source/translation,
LTR token isolation, technical/user-content isolation and locale persistence are
covered. Source/Translation labels use explicit translations so switching back to
English cannot retain whitespace-prefixed Arabic labels.

Browser review covered 1440, 1280, 1024, 768, 430, 390 and 360px; Arabic desktop
and mobile; dark scrollbars; balanced Local navigation; readable context/tokens;
usable Save/Export and reserved locale-control space. Shared Cloud presentation
remains covered by its existing responsive/accessibility suite. No serious or
critical axe violations or review-browser errors were observed.

## Permanent Cloud deletion security and dependencies

`DELETE /api/projects/:projectId` uses existing verified authentication. SQL is
parameterized; a transaction locks the visible project and checks the current
owner before deleting it. Owner succeeds; editor/viewer receive 403; unrelated
users and absent/already-deleted projects receive 404; unauthenticated users
receive 401. Unexpected failures return safe generic errors. There is no path or
filesystem operation and no client-only authorization assumption.

Actual migration audit found four project child tables, all already cascading:

| Table | Migration | Dependency |
| --- | --- | --- |
| project_memberships | 002 | projects(id), ON DELETE CASCADE |
| project_assignments | 003 | projects(id), ON DELETE CASCADE |
| project_comments | 003 | projects(id), ON DELETE CASCADE |
| project_activity | 003 | projects(id), ON DELETE CASCADE |

No schema migration is necessary. Actual migrations and PostgreSQL constraints
run in isolated PGlite tests, including a failing child-delete trigger that proves
transaction rollback. All four child categories disappear together, while another
project, accounts, auth sessions, Admin and Radio records remain unchanged.
Only live collaboration rooms for the deleted project are revoked, using the
existing membership-revoked protocol. No production database was changed.

Web owner cards expose a quiet keyboard-accessible actions menu; Overview exposes
an owner-only Danger Zone. The shared Web/Desktop native modal requires the exact
project name, supports cancellation/focus/Escape, disables duplicate submission,
and preserves state on failure. Success removes/refreshes the card or returns to
Projects. Desktop success resets the Cloud workspace, dirty/revision/selection
state and stale last-session reference, then refreshes Home; failure keeps the
unsaved draft. Local .lhproj projects never expose Cloud deletion.

Desktop E2E uses the real production React bundle with only native-window IPC
and synthetic HTTP isolated. It is not a claim of manually clicking an installed
Windows binary. Desktop filesystem serialization has separate real temporary-file
coverage. No original/local/exported files are deleted by the server operation.

## Final implementation gates

- Frontend build, website build and Desktop production endpoint verification: pass.
- Vitest: **646 passed, 61 files, 0 failed**, including token/extraction/context tests.
- Collaboration server: **148 passed, 30 suites, 0 skipped/failed**.
- Rust: **13 passed**; cargo check passes.
- Full Playwright: **1215 passed, 105 skipped, 0 failed** (1320 cases, 6.4 minutes).
- The 105 skips are existing viewport/feature-conditional cases; no new skip or
  retry hides failures. Workers are bounded at four for browser + PostgreSQL/WASM
  resource use. Tests await real new metadata reads rather than an old SPA
  networkidle event. Immediate Local shortcut regressions were fixed in source.
- Performance: **2 passed**, including 10,000 canonical entries (97ms test total).
- i18n/leakage audit: **951 keys / 1010 UI strings**, no findings.
- npm audit: **0 vulnerabilities**.
- Server MJS syntax and git diff --check: pass.
- Built Web/Desktop scan: no loopback endpoint, database credentials, private-key
  material or TOTP URI. Ignored secret files remain ignored and untouched.

## Known constraints and next step

Browser persistence is origin/device-bound and can be cleared or evicted; explicit
Save and exported backups remain important. Offline editing requires the app to
already be loaded. Local mode does not synchronize or collaborate. MT requires
explicit external-provider use. Raw formats do not prove an engine. Cloud deletion
is permanent, without Trash. Windows x64 is the packaged Desktop target; existing
unsigned-installer/SmartScreen and deep binary/external-tool limits remain. Only
English/Arabic UI is supported. Radio stays PostgreSQL-backed and optional audio
optimization depends on deployment ffmpeg/ffprobe. Existing bundle-size advisories
are non-failing; performance gates pass.

Main and v0.9.0 remain unchanged at this checkpoint. The RC is ready for the scoped
0.9.1 version bump, repeated release gates, packaging, no-ff merge, public release
and production verification. No release tag or deployment is claimed here.
