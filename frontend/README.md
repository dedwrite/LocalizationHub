# LocalizationHub Desktop

The Windows desktop client uses React, TypeScript and Tauri/Rust. It shares localization models, parsers and token validation with the Web App.

See the [project README](../README.md) for features, screenshots and downloads.

## Run locally

Install Node.js/npm, Rust and the Windows Tauri build prerequisites (MSVC C++ build tools and WebView2). Run from the repository root:

```sh
npm ci
npx tauri dev
```

The Tauri configuration starts the frontend development server. Cloud features require the configured production or development endpoints; do not put credentials in source files.

## Validate and build

From the repository root:

```sh
npm run build --prefix frontend
npm run verify:production --prefix frontend
npm test
npm run desktop:release
```

The Windows NSIS installer is written to `src-tauri/target/release/bundle/nsis/`. Release builds validate the Cloud endpoint configuration and disable the development URL.

These commands build locally; they do not publish a release or sign the installer. Keep application identifiers and storage locations stable to preserve upgrade compatibility.
