# Maintainer summary

LocalizationHub is a local-first game localization workspace maintained by **DEDTYPE**. It helps translators import structured text, retain available speaker/listener/scene context, protect placeholders and formatting tags, review translations and export without losing the source structure.

The project contains a Windows Tauri/Rust client, a browser editor, a React public site, a shared TypeScript localization core and English/Arabic catalog, and a Node/PostgreSQL Cloud collaboration service. Arabic/RTL support matters because UI direction, source direction, target direction and embedded tokens can differ in one entry; a mirror of an English layout alone is insufficient.

The maintainer works on these clients, parsing/token compatibility, workflow and quality tools, optional engine extraction, permissions, tests, releases and documentation. Existing public releases run from v0.2.0 through v0.9.10; the current Windows installer and checksum are linked from the official site. Engine support has documented limits and may require separately installed tools.

Testing includes Vitest across frontend/core/i18n, Node server tests, PostgreSQL/WASM lifecycle tests and Playwright Chromium/WebKit coverage. Desktop React tests isolate native boundaries; they are not proof of installing or upgrading a native binary. See the current verification record and CI for actual run results rather than assuming every historical test is green.

Contributors can report reproducible issues, improve EN/AR messages and RTL behavior, add synthetic parser fixtures, fix bugs and submit focused PRs following CONTRIBUTING.md. Vulnerabilities have a private reporting path in SECURITY.md.

Potential additional developer tooling/API credits could support PR review assistance, issue triage, localization QA, placeholder validation, RTL regressions, test generation, documentation and release automation. These are proposed maintenance uses, not claims that autonomous API-powered systems already exist. No popularity, contribution, usage or support-program eligibility metrics are claimed. No external application has been submitted by this work.
