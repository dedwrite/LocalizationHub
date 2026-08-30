# LocalizationHub v0.9.1 release verification — 2026-08-30

## Final status: BLOCKED, not accepted as a completed public release

Implementation, packaging, merge, tag, GitHub asset upload and the existing
production auto-deployment completed. Automated release gates passed. Final
verification found two unresolved blockers; this document does **not** certify
public release success or human acceptance:

1. `dedwrite/LocalizationHub` is **PRIVATE**. GitHub release 379386939 is neither
   draft nor prerelease, but anonymous repository/asset requests return 404.
   The same anonymous-download limitation also affects v0.9.0. Publishing a
   non-draft release does not make assets of a private repository public.
   Repository visibility was not changed: doing so would expose the entire
   source/history, not merely the installer. Public distribution needs an
   explicit choice/authorization (repository visibility or a separate public
   distribution location).
2. Final production browser review at 390 x 844, Arabic, found the collapsed
   Radio capsule overlapping Local editor navigation. The capsule occupies
   y=694..768; Previous/Next occupy y=673..717, and untranslated navigation
   y=725..769. The second navigation row is covered. The automatic no-overflow,
   lifecycle and accessibility checks passed but did not assert this hit-area
   separation. This is a real visual/usability gap, not a console exception.
   No post-tag source fix, tag rewrite, rollback or new release was performed.

The immutable v0.9.1 tag remains on the release merge. A corrective publication
decision is required; do not silently call this SUCCESS or move the tag.

## Git identity

| Item | Value |
| --- | --- |
| Starting main/origin main | `74a272ee9ca01aadd258b5ce2426a02400332694` |
| Feature branch | `feature/v0.9.1-local-parity-project-delete` |
| Main implementation | `4b8a35887b142a5e94b740fd121c185c0b2f7271` |
| Save/locale regression closure | `0368938831d6fd081e26d6f6fb7a4f4c1169b414` |
| RC document commit | `7df611285c54aa694768bdec15834474c84e1c8e` |
| RC tag | `checkpoint-v0.9.1-release-candidate-2026-08-30` |
| RC annotated object | `93ae0bbbe1851ea57ef5e4d200d0e11cfc2cf415` |
| Release preparation | `c855a862c820828d5e9c1bbc59998d8534b34b56` |
| Post-RC keyboard fixes | `77787f7e23e20e727888c922c708186d234d69c5`, `1b0dafd0f351c1c142ffa2fca40b9a09f9adeb98`, `96ca90d1f0b66ebdeda2a911bbb5460f3f4de2ab` |
| No-ff release merge | `ae90c8087bd3c2acc650729d0c164f77b1f66a61` |
| Release tag | `v0.9.1` |
| Annotated release object | `52d6f741da71063b7a8db0327b29ece661d511d2` |
| Remote peeled release commit | `ae90c8087bd3c2acc650729d0c164f77b1f66a61` |

Main was rechecked against the baseline immediately before merge/push. Remote
main matched the merge before the release tag was created. This document is a
subsequent, normal documentation-only main commit, not part of the release tag.
Its commit identity is the commit adding this file. The feature branch is pushed.

All 70 pre-existing local tag objects remain unchanged. All 69 of those found
on origin match their original objects; the older local-only
`checkpoint-v0.7-real-unreal-pipeline-2026-08-27` was absent remotely and was not
published or changed. RC remains unchanged. v0.9.0 object
`68e4dd7fe99fe09016cda9856195acefcbab7f15` still peels to
`9fd4daa5cafdd9cd9e0d8ecd3191b320902e94a4`.

## Local Workspace parity

Local and Cloud share Workspace, EditorPanel, EntriesPanel, Inspector,
ProjectOverview, MobileWorkspace and token/profile QA. A small storage adapter
keeps Cloud HTTP persistence and browser IndexedDB persistence separate. Local
mode does not instantiate Cloud authentication restoration, autosave,
collaboration, roles, revisions, memberships, comments, assignments or history.

Browser rows retain the existing IndexedDB database/store/version and identity.
Values use canonical LocalizationProjectV3 with original document/export
structure, entries, translations, canonical dialogueContext, workflow, selected
entry, metadata, tokenProfile, tokenProfileConfig and engineDetection. Legacy
parsed-document copies normalize in memory without reparsing source, deleting
copies or rewriting storage on open. Explicit Save upgrades the stored value.
Original disk files are never modified by migration or browser-copy deletion.

Shared features include source highlighting/copy, actionable protected-token
QA, independent target direction, search/virtualized entry list, translated and
completion counts, Draft/Translated/Needs Review/Approved, all four navigation
actions, Ctrl+S/save-and-navigate/Alt-arrow shortcuts, unsaved route/Back/reload
guards, save feedback, quota-failure draft preservation and original-format
JSON/CSV/PO/POT export. Selection/save races discovered by repeated post-RC
gates were fixed without moving the RC tag. Auto, Generic, Godot, Unreal and
Unity profile state persists, including honest unknown-engine fallback and
manual overrides/mismatch behavior.

Canonical Caloy (male) -> Mark (male), Sofia (female) -> KuyaGrab (male), explicit
multiple listeners/genders and scene survive Local, Cloud Web and Desktop
lifecycle tests. Context is consumed, not inferred again in JSX. English/Arabic
labels, root RTL, source/target independent direction, LTR tokens and technical
content isolation are covered. Prior local visual review covered 1440, 1280,
1024, 768, 430, 390 and 360px; final production review additionally exposed the
mobile Radio overlap above, so visual closure is not claimed.

Local import/edit/workflow/profile/save/export requires no account, uploads or
project API. Browser copies remain origin/device-bound. Existing MT is explicit
only and sends current text/context to the chosen provider, never the complete
project. No new provider, automatic translation or synchronization was added.

## Owner-only Cloud deletion

`DELETE /api/projects/:projectId` uses existing verified authentication and
parameterized SQL. In one transaction it locks the visible project, checks its
current owner and deletes it. Owner succeeds; editor/viewer receive 403;
unrelated, missing and repeated-delete requests receive 404; unauthenticated
requests receive 401. Unexpected errors remain generic. Client visibility is
not the authorization boundary.

Verified migrations already use `projects(id) ON DELETE CASCADE` for all four
child tables: project_memberships (002), project_assignments, project_comments,
project_activity (003). No schema migration is required. Isolated actual
PostgreSQL/PGlite migration tests verify cascades, a forced rollback, and
preservation of unrelated projects/users/auth/Admin/Radio data. Only the deleted
project's live collaboration rooms are revoked via the existing protocol.
There is no filesystem deletion; original files, browser copies, exports and
Desktop .lhproj files are unaffected.

Web owners get the quiet card actions menu and Overview Danger Zone. Shared
Web/Desktop native confirmation requires the exact name, supports focus/Escape/
Cancel, prevents duplicate submission, and preserves the workspace on failure.
Web success refreshes/removes the card or returns to Projects. Desktop success
resets Cloud workspace/dirty/revision/selection/last-session state and refreshes
Home; failure retains the unsaved draft. Editors/viewers see no delete action;
ordinary local .lhproj files never expose Cloud deletion.

## Automated gates

| Gate | Final result |
| --- | --- |
| Frontend / website production builds | Pass |
| Vitest | 646 passed, 61 files, 0 failed |
| Collaboration server | 148 passed, 30 suites, 0 failed/skipped |
| Cargo test | 13 passed, 0 failed |
| Cargo check | Pass |
| Desktop production endpoint verification | Pass |
| Performance | 2 passed; 10,000-entry coverage; final test total 96ms |
| npm audit | 0 vulnerabilities |
| i18n + Arabic leakage | 951 keys, 1010 UI strings, no findings |
| Server MJS syntax / git diff --check | Pass |
| Final pre-merge Playwright, first run | 1215 passed / 105 skipped / 0 failed, 5.8m |
| Final pre-merge Playwright, second run | 1215 passed / 105 skipped / 0 failed, 5.7m |
| Post-merge Playwright | 1215 passed / 105 skipped / 0 failed, 6.5m |
| Real deployment freshness | 1 passed, 3.1m |
| Production desktop + mobile Local lifecycle | 2 passed, 13.1s |

The 105 skips are pre-existing viewport/feature conditions; retries remain zero.
Earlier failing attempts were not treated as gates. Desktop UI E2E uses the
real production React bundle with isolated native IPC/HTTP; this is not a claim
of a manual installed-binary owner-delete test. Real temporary .lhproj filesystem
serialization and isolated backend lifecycle tests provide separate coverage.
Final browser review found an uncovered hit-area issue despite green automation.

## Packaging and GitHub assets

All current product package/version locations (root, frontend, website, core,
i18n, collaboration server, Tauri and Cargo) are 0.9.1. Current bilingual
landing/download metadata and release notes were updated; historical metadata
was not rewritten.

Production Tauri/NSIS build passed. Final packaging used a non-secret local
config overlay equivalent to `{"build":{"devUrl":null,"beforeDevCommand":null}}`
with `npx tauri build --config <overlay-file>`. This removes development metadata
from the executable while retaining the production build command and endpoints.
The original developer configuration remains unchanged. Final build took 1m39s.

| Artifact | Path | Bytes |
| --- | --- | ---: |
| Executable | `src-tauri/target/release/localizationhub.exe` | 17,295,872 |
| Installer | `src-tauri/target/release/bundle/nsis/LocalizationHub_0.9.1_x64-setup.exe` | 5,698,593 |
| SHA-256 companion | `LocalizationHub_0.9.1_x64-setup.exe.sha256` | 102 |

Both Windows file versions are 0.9.1. Installer SHA-256:

`01111047fb1494794b31a48b75ea71b4282fe720c79cdeb1c25baee3e8dccfed`

Final binary scans found no configured localhost/127.0.0.1 development endpoint,
database-credential URI, private-key marker or TOTP enrollment URI. Only intended
frontend assets are bundled; no secret env, database dump, Radio media or game
corpus resource was added. Framework-internal WebView origins are distinct from
development endpoints. Ignored secret files remain ignored and unmodified.

GitHub release: https://github.com/dedwrite/LocalizationHub/releases/tag/v0.9.1

- Release ID: `379386939`; draft=false, prerelease=false; repository=PRIVATE.
- Installer asset ID: `537001231`, uploaded, 5,698,593 bytes.
- Checksum asset ID: `537001229`, uploaded, 102 bytes.
- GitHub installer digest: `sha256:01111047fb1494794b31a48b75ea71b4282fe720c79cdeb1c25baee3e8dccfed`.
- Authenticated download was read back and its size/SHA-256 matched local/GitHub.
- Only the 0.9.1 installer and its checksum are attached.
- **Anonymous download: 404; public distribution is blocked by repo visibility.**

## Production verification

Existing main auto-deployment completed without changing production secrets,
deployment stack or database records. Manifest changed from
`assets/index-B2r1buKz.js` to `assets/index-BtjpOp5w.js`;
`/web-build.json` is 200 with Cache-Control: no-store. `/health`, `/`, `/download`,
`/app/local` and `/app/projects` return 200. Anonymous `/api/projects` returns 401.

The real old-tab test spans the actual deployment and serves real old/new static
assets/manifests. Only synthetic auth/project API responses are intercepted:
stale Create is blocked before POST, then fresh reload preserves Caloy/Mark in
the captured canonical payload. No production project writes occur.

Unmocked production Chromium desktop and WebKit 390px tests verified version
0.9.1, English default, Arabic persistence/RTL, current download-link target,
account-free synthetic Local import, context/listener/tokens, translation QA,
Approved workflow, Unity override, Save/reopen persistence and original-format
export. Network assertions observe zero write requests, zero non-Radio API calls
during Local editing and no page errors. Manual production Arabic/mobile review
also had no error logs, but found the overlapping controls described above.

Live authenticated Cloud workspace/delete was not exercised: no disposable
authenticated production session was used, and no real user project was touched.
Owner/editor/viewer UI and actual deletion authorization/cascades/lifecycle are
covered by the complete isolated integration/E2E suite; production auth-route
availability was verified. No claim of a live destructive production test is made.

Radio catalog: 200, 8 tracks. For one existing public track, audio and artwork
GET return 200; HEAD returns matching length/type/Accept-Ranges and zero body;
Range bytes=0-1 returns 206 and two bytes. Audio total is 6,383,116 bytes and
artwork 43,406 bytes. Production player/perimeter SVG and expanded tagline are
visible; fresh playback is paused. Radio behavior was not redesigned.

## Known limitations and handoff

Public-download access and mobile navigation overlap are unresolved blockers,
not accepted design limitations. No v0.9.2, v0.10 or v1.0 work was started.

Other existing constraints remain: Windows x64/unsigned installer and possible
SmartScreen; English/Arabic only; no new engines/reinjection/deep binary promises;
browser storage can be cleared or evicted, so explicit Save/export backups matter;
loaded-app requirement for offline browser work; permanent Cloud deletion without
Trash; explicit external MT; PostgreSQL-backed Radio and optional deployment
ffmpeg/ffprobe. Existing bundle-size warnings are advisory, not failed gates.

Next action requires an explicit public-distribution decision and a corrective
release approach that keeps the existing v0.9.1 tag immutable. Git worktree is
intended to be clean after this documentation-only commit is pushed; its final
HEAD/origin equality is reported separately to avoid a self-referential SHA.
