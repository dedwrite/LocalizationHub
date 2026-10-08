<p align="center">
  <img src="website/public/brand-primary.svg" width="64" alt="LocalizationHub logo">
</p>

<h1 align="center">LocalizationHub</h1>

<p align="center">A local-first workspace for game localization.<br>Translate with context. Protect game syntax. Review before you export.</p>

<p align="center">
  <a href="https://localizationhub.app/">Website</a> ·
  <a href="https://localizationhub.app/app/local?sample=northern-gate">Try the editor</a> ·
  <a href="https://github.com/dedwrite/LocalizationHub/releases/latest">Windows download</a> ·
  <a href="https://localizationhub.app/reference">Documentation</a>
</p>

![LocalizationHub browser workspace with dialogue context, protected tokens and Arabic translation](docs/images/workspace.png)

## Built for game translators

- **Context beside the text** — speaker, listener and scene information when present in the source.
- **Protected syntax** — placeholders, tags and engine-aware token checks stay visible while you translate.
- **Review tools** — workflow states, QA, glossary, Translation Memory, search and bulk actions.
- **Arabic and RTL** — English/Arabic interface with independent source and translation reading directions.
- **Local or shared** — work locally without an account, or choose Cloud Projects with role-based collaboration.
- **Game text extraction** — the Windows app scans supported Godot, Unreal and Unity resources without modifying the originals. [Compatibility and helper-tool requirements](docs/dev/v0.7-engine-compatibility.md).

Open JSON, CSV or gettext PO files, and save work as a LocalizationHub project (`.lhproj`). Browser, Desktop and Cloud workflows share the localization core.

## Get started

**In your browser:** [open the Northern Gate sample](https://localizationhub.app/app/local?sample=northern-gate), edit a translation, check its tokens and export. No account needed for local files.

**On Windows:** download the **v0.9.10 x64 installer** and its SHA-256 checksum from [Releases](https://github.com/dedwrite/LocalizationHub/releases/tag/v0.9.10). Release assets require repository access while this repository is private.

**With a team:** create an account, verify your email and use Cloud Projects. Owners, Editors and Viewers have server-enforced permissions.

![LocalizationHub Home with an interactive English-to-Arabic localization example](docs/images/home.png)

## Your files, your choice

Local browser projects stay in that browser profile; browser storage is not a backup. Export important projects regularly. Cloud Projects upload when you choose Cloud, and external translation providers receive text when you request their services.

Game extraction is read-only. It is not game-resource injection, archive repacking or executable modification.

The Windows installer is **unsigned** and may trigger SmartScreen. Back up important projects before upgrading.

## Development

React · TypeScript · Tauri/Rust · Node.js · PostgreSQL

```sh
npm ci
npm run website:dev
```

For Desktop setup and builds, see [frontend/README.md](frontend/README.md). For a same-origin local backend, configure the ignored `collaboration-server/.env.local`, then run `node collaboration-server/dev.mjs`. Cloud features require PostgreSQL and the appropriate service configuration; never commit secrets.

```sh
npm test
npm run website:build
npm run test:i18n
```

## Learn more

[Release notes](docs/releases/v0.9.10.md) · [Engine compatibility](docs/dev/v0.7-engine-compatibility.md) · [Token profiles](docs/dev/token-profiles.md) · [UI internationalization](docs/dev/ui-internationalization.md)

---

Made by [DEDWRITE](https://dedwrite.xyz/) · [Privacy](https://localizationhub.app/privacy) · [Terms](https://localizationhub.app/terms)
