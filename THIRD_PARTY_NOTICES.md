# Third-Party Notices

The root MIT license applies to first-party LocalizationHub code only. Third-party code, fonts and tools keep their own licenses. Do not treat this page as a substitute for their full copyright/license texts.

## Bundled fonts

The website ships these font files and their full SIL Open Font License 1.1 notices:

- Inter — [notice](website/public/fonts/Inter-LICENSE.txt).
- Noto Sans Arabic — [notice](website/public/fonts/noto-sans-arabic-OFL.txt).
- Schibsted Grotesk — [notice](website/public/fonts/schibsted-grotesk-OFL.txt).

Retain these notices when redistributing the fonts. The font licenses are not changed to MIT.

## Application dependencies

The browser/Desktop frontend uses React, CodeMirror, Tauri plugins and other npm dependencies; the Node backend uses PostgreSQL/ws/music-metadata packages. The native app also links Rust crates including Tauri, Serde and reqwest. These are third-party dependencies, not first-party MIT code.

Exact npm versions, license identifiers and integrity hashes are recorded in `package-lock.json`; full dependency license files are included in installed packages. Exact Rust versions are in `src-tauri/Cargo.lock`, with license declarations and notices in each crate. A distributor must retain applicable license/copyright notices for the dependencies actually shipped, including transitive dependencies. New dependencies and binary releases need their own attribution review.

This source-repository cleanup does not replace or relicense already-published installer assets. It does not certify that every historical binary bundled a complete attribution inventory.

## Optional external extraction tools

These tools are installed/configured separately and invoked as external processes. They are not bundled by the current extraction adapters. Users redistributing them must comply with the relevant upstream licenses and notices.

| Tool | Use | Upstream license |
| --- | --- | --- |
| [repak](https://github.com/trumank/repak) | Unreal PAK resources | MIT OR Apache-2.0; see both upstream license files |
| [retoc](https://github.com/trumank/retoc/blob/master/LICENSE) | Unreal IoStore resources | MIT |
| [UAssetAPI](https://github.com/atenfyr/UAssetAPI/blob/master/LICENSE) | Unreal asset inspection via separately configured adapters | MIT |
| [GDRE/gdsdecomp](https://github.com/GDRETools/gdsdecomp/blob/master/LICENSE) | Godot PCK resources | MIT |
| [UnityPy](https://github.com/K0lb3/UnityPy/blob/master/LICENSE) | Unity asset resources | MIT |

Upstream repository license declarations were checked on 2026-10-22. Support limits and helper requirements are documented in [engine compatibility](docs/dev/v0.7-engine-compatibility.md). Game engines, game text, media and third-party trademarks are not relicensed by LocalizationHub.
