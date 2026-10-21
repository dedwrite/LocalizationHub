# Windows release process

## Prepare

1. Use a clean feature branch and install Node.js 24 LTS, npm, stable Rust, MSVC C++ tools and WebView2 on Windows.
2. Review security reports and third-party license requirements. Stop publication if a real credential or private user data is exposed.
3. Synchronize the version in root/workspace package manifests, workspace dependency versions, `src-tauri/Cargo.toml`, `Cargo.lock`, `tauri.conf.json` and npm lockfile. Add factual release notes under `docs/releases/`. Do not move existing tags.
4. Run `npm ci`, `npm test`, `npm run test:i18n`, `npm run website:build`, relevant Playwright checks and `git diff --check`. The manual Windows workflow can produce a candidate but never publishes it.

## Build and verify

```powershell
npm run desktop:release
npm run verify:production --prefix frontend
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$installer = "src-tauri/target/release/bundle/nsis/LocalizationHub_${version}_x64-setup.exe"
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $installer).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$installer.sha256", "$hash`n")
```

Verify the binary version and installer UI, including the light instruction pages and branded artwork. Test a clean install and an upgrade with disposable backed-up projects; never test by resetting real user data. Record anything not tested. No signing certificate is configured: do not claim a signed or Microsoft-verified installer.

## Publish, explicitly

After review, commit the release source, create a new annotated `vX.Y.Z` tag on that commit, and push normally. Use GitHub CLI to create a **draft** release and upload only the matching `.exe` and `.sha256`; inspect the assets and notes, then publish the stable release. Avoid privileged automation on pull requests.

Verify both asset URLs with a plain unauthenticated HTTPS request, download the installer and compare its hash with the published checksum. Public repository visibility, a published non-draft/non-prerelease release and uploaded assets are all required.

## Website metadata

`website/src/config/site.ts` is the single source for the latest **verified published Windows release**, its exact official GitHub asset URLs and SHA-256. Update it only after publication and verification, never to an unpublished candidate. Keep the root/package versions synchronized for the release separately; the website may intentionally still offer an older verified installer while the next version is being built.

The website uses static verified metadata: no visitor-time GitHub API request, rate-limit dependency or arbitrary host redirect. `/download` always links to all releases as a fallback. If a new stable release lacks a Windows installer/checksum, do not point the site at it; keep the previous verified pair and repair publication through a new reviewed release.

## Rollback

Revert the website metadata to the previous verified installer with a normal commit. If a binary is unsafe, mark the affected release clearly and coordinate removal with the maintainer; never silently replace an asset or move an old tag. Deploy website fixes through the existing main/Render process, then verify `/download`, the version, checksum and anonymous links. Rollback does not mean restoring or modifying Cloud databases.
