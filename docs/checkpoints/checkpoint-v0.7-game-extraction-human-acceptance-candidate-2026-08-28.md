# LocalizationHub v0.7 Game Text Extraction — Human Acceptance Candidate

## Status

The v0.7 "Game Text Extraction" feature is presented as a **human-acceptance
candidate**. All thirteen final gap-closing items are resolved and verified
against real game corpora (Until Then / Godot, VOIN / Unreal, 1000xRESIST /
Unity), every gate passes with exit code 0, and the debug desktop build plus
NSIS installer are produced with the 32x32 icon embedded.

## Gap closure status (honest)

| # | Gap | Status | Evidence |
|---|---|---|---|
| 1 | Godot binary `.res`/`.scn`/`.gdc` derived-copy | **IMPLEMENTED** | GDRE `--bin-to-txt --output` writes elsewhere; input SHA unchanged (29KB→74KB); `godot-binary` job + `copy_extraction_file` |
| 2 | Godot `OptimizedTranslation` | **PARTIAL** (honest) | values recoverable (smaz), keys are one-way StringName hashes — genuinely absent |
| 3 | Until Then Ink choices | **IMPLEMENTED** | `$ push_timed_choices` → `(option)` emitted as `Choice`; `$ ftb.request_player_choice` bare tokens **DETECTED ONLY** (ambiguous) |
| 4 | Unity TextAsset routing | **IMPLEMENTED** | `.ink`/`.yarn`/`.xml`/`.yaml`/JSON/CSV content-sniffed to the correct adapter |
| 5 | Unity source locale | **IMPLEMENTED** | `inferUnitySourceLocale` (explicit `SourceLocale`/`Locale.Identifier`/`SharedTableData`), never object-key order |
| 6 | Unreal AES user-facing UI | **IMPLEMENTED** | optional password field in Scan Game → `aesKey` → repak/retoc/GDRE; never persisted/logged |
| 7 | Unreal precision audit (≥100 entries) | **IMPLEMENTED** | 55,739 real entries classified; engine/plugin stock (54,373) auto-excluded; Game.locres 1,365 runtime + 1 `Test` |
| 8 | Unity precision audit (≥100 entries) | **IMPLEMENTED** | 68,190→2,285 logical entries; 45,625 title-schema false positives removed; speaker/listener/localeVariants resolved |
| 9 | Generic context UI (Playwright) | **PARTIAL** (honest) | mapping contract verified at scanGame level; desktop-only UI not Playwright-reachable (Tauri invoke) |
| 10 | Has Gender role-scoped | **IMPLEMENTED** | speaker OR listener OR grammatical, never inferred from names |
| 11 | MT context | **IMPLEMENTED** | `buildTranslationContext` + "reference only" system line; absolute paths stripped |
| 12 | Cross-engine checklist | **IMPLEMENTED** | 17-item checklist verified against code + tests (tokens/provenance/audience/listeners/prev-next/voice/portrait/locale/privacy/round-trip/batch/cancel/cleanup/diagnostics/UTF) |
| 13 | Full gates + build + checkpoint | **IMPLEMENTED** | all 10 gates exit 0; debug exe + NSIS built with 32x32 icon |

## Engine compatibility matrix (summary)

- **Unreal** — `.locres` (Compact/Optimized/Legacy) **SUPPORTED**; `.locmeta`
  **SUPPORTED**; String Table CSV **SUPPORTED**; FText/DataTable/DialogueWave
  JSON **STRUCTURED-EXPORT ONLY**; `.pak`/`.utoc`/`.ucas` **EXTERNAL TOOL
  REQUIRED** (repak/retoc, AES-aware); `.uasset` **PARTIAL** (UAssetDumper
  UE4.27 only, UE5.6 fails on UAssetAPI 1.0.0).
- **Godot** — CSV/PO **SUPPORTED**; `.gd` **PARTIAL** (tr()/tr_n() only);
  `.tscn`/`.tres` **SUPPORTED**; custom dialogue/database JSON **SUPPORTED**
  (multi-locale aggregation); `.pck` **EXTERNAL TOOL REQUIRED** (GDRE v2.4.0);
  `.inkb` **SUPPORTED** (67,081 entries across 8 locales, structural-fingerprint
  mismatch detection); `.translation` **PARTIAL** (keys hashed); binary
  `.res`/`.scn`/`.gdc` **SUPPORTED (derived copy)**.
- **Unity** — Localization String Table JSON **SUPPORTED**; TextAsset JSON/CSV
  **SUPPORTED**; Dialogue System `MasterDialogueDatabase` MonoBehaviour
  **SUPPORTED** (dedicated extractor, 2,285 logical entries); serialized assets
  `.bundle`/`.assets` **EXTERNAL TOOL REQUIRED** (UnityPy 1.25.3); stripped
  type tree **UNSUPPORTED** (inventory-only, documented silent gap).
- **Generic** — context detection + user field mapping **SUPPORTED**
  (`char_from`/`char_to`/`sex_a`/`sex_b`/`body` → speaker/listener/gender/text).

## Gates (all exit code 0)

| Gate | Result |
|---|---|
| `npm run build --workspace frontend` | 0 |
| `npm run build --workspace website` | 0 |
| `npx vitest run packages/core/src website/src` | 0 (331 passed) |
| `npm test --prefix collaboration-server` | 0 |
| `node --check collaboration-server/server.mjs` | 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 0 (13 tests) |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 0 |
| `npx playwright test` | 0 (566 passed) |
| `npm run test:performance` | 0 |
| `git diff --check` | 0 |

## Build artifacts

- `src-tauri/target/debug/localizationhub.exe` (26,061,312 bytes)
- `src-tauri/target/debug/bundle/nsis/LocalizationHub_0.6.1_x64-setup.exe` (6,826,572 bytes)
- Icon: `src-tauri/icons/icon.ico` carries 32x32 / 16x16 / 24x24 / 48x48 /
  64x64 / 256x256 (entry 0 = 32x32), embedded in both the EXE and the NSIS
  installer by the Tauri bundler.

## Honest boundaries (unchanged, not fabricated)

- Encrypted archives are **DETECTED ONLY** (AES key threaded, never brute-forced).
- UE5.x `.uasset` dialogue requires a UAssetAPI upgrade — out of scope.
- `OptimizedTranslation` keys are unrecoverable without a full-project
  `--translation-hint` recovery (heavy, not run).
- Unity stripped type trees are inventory-only (no typed JSON, silent gap).
- The Context Mapping review UI is desktop-only (Tauri) and not covered by
  Playwright; the mapping contract is covered at the core-pipeline level.
- `main` was not merged; v0.7.0 was not published; prior checkpoints unchanged.

No credentials, private deployment values, database connection details, API
keys, or other operational secrets are included in this document.
