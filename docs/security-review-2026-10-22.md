# Public readiness security review — 2026-10-22

Scope: tracked source/configuration, reachable Git history, public release assets and selected authentication/authorization boundaries. This is not a penetration test or a guarantee that no unknown vulnerability exists. No production data or secret values are included here.

## Secrets and public artifacts

- Gitleaks 8.30.1 examined all reachable refs (297 commits with scannable changes, about 6 MB). Two detections were independently classified as a public RFC HOTP test vector and a fake Playwright session hash. `.gitleaksignore` lists only those exact historical fingerprints, not broad path exclusions.
- An additional exact-value scan compared locally configured secret candidates against 2,371 reachable file versions; no matches were found. The local environment remained ignored and unchanged.
- Downloaded and unpacked 19 published installers without executing them. Gitleaks found no secrets in scannable extracted files; exact known-secret matching examined 153 extracted files, about 330 MB, without a match. This does not inspect runtime memory or decode every compressed resource embedded inside executables.
- `frontend/.env.production` contains only intended public HTTPS API and WSS relay URLs. No private key, password or API token belongs in client configuration.
- No secret or sensitive-data removal from public history was necessary. Maintainer explicitly accepted the existing commit-author email; no history rewrite or force-push was performed.
- GitHub secret scanning, push protection and private vulnerability reporting are enabled. GitHub's current secret alerts were empty at review time; that is not an exhaustive proof.

## Server boundaries

Reviewed bearer session lookup/expiry/suspension checks, project membership filtering, owner-only mutations, viewer write denial, Admin session binding, bounded JSON body parsing, CORS preflight handling and one-use expiring WebSocket tickets. Existing isolated tests exercise access denial, owner/viewer lifecycle behavior and MFA errors. No authentication, schema, permissions, production environment or infrastructure change was required.

Anonymous GETs to production `/api/projects`, `/api/admin/radio/tracks` and `/api/admin/users` returned 401. This is a narrow read-only probe, not a full adversarial assessment. CORS alone is not treated as authorization.

## Dependency findings

Node advisories were addressed through same-major updates to the existing Vite/Vitest/music-metadata dependency graph. `npm audit` reported zero vulnerabilities after the update; tests and both client builds were rerun.

The `cargo-audit` command was unavailable. Instead, all 529 registry package/version pairs from Cargo.lock were queried through the public OSV advisory API. Targeted compatible updates applied:

| Crate | Before | After |
| --- | --- | --- |
| rustls | 0.23.43 | 0.23.46 |
| rustls-webpki | 0.103.15 | 0.103.16 |
| quinn-proto | 0.11.17 | 0.11.19 |
| webpki-root-certs | 1.0.9 | 1.0.10 |

A repeat OSV query no longer reported the TLS/QUIC/certificate advisories for those versions. Rust tests passed after the update.

Remaining lockfile findings need upstream follow-up: unmaintained bincode/proc-macro-error/unic/zbus/zvariant families, and glib 0.18.5's RUSTSEC-2024-0429 iterator unsoundness (fixed upstream at 0.20). glib is absent from the Windows dependency tree; it belongs to the unsupported Linux Desktop dependency chain, not the Node website backend. Replacing these dependencies requires a broader reviewed upstream/Tauri update, not an untested cleanup upgrade.

**Published installers are unchanged.** The verified v0.9.10 binary predates these Rust source fixes. A separately tested future Windows security release is required to ship them to Desktop users; source changes do not remediate an already-downloaded executable. No new installer was published in this task.

## Operational and licensing boundaries

The unrelated AFTERHOURS file was removed only after checking that both Render services use the separate AFTERHOURS repository. No external data, secret or service configuration changed. Existing history was preserved.

MIT was explicitly approved for first-party code. Bundled font OFL notices remain intact. Optional helper-tool license declarations were checked upstream and corrected where needed. This review did not certify a complete license inventory inside every historical installer; distributors still need to preserve applicable transitive notices.
