# Third-Party Notices

LocalizationHub v0.7 extraction may invoke the following third-party tools as
**optional external adapters** (not bundled into LocalizationHub itself). Each
is invoked as a separate process with strict isolation (no shell interpolation,
timeouts, isolated temp directories). Users must obtain and configure these
tools separately.

## Unreal Engine tooling

- **repak** — Unreal `.pak` reader/writer.
  - License: Apache-2.0 and MIT (see upstream).
  - https://github.com/trumank/repak
- **retoc** — Unreal IoStore (`.utoc`/`.ucas`) reader.
  - License: permissive (see upstream LICENSE).
- **UAssetAPI** (via UAssetDumper) — Unreal `.uasset` JSON import/export.
  - License: MIT.
  - https://github.com/atenfyr/UAssetAPI

## Godot tooling

- **gdsdecomp** (or equivalent PCK reader) — Godot `.pck` extraction.
  - License: MIT.
  - https://github.com/GDRETools/gdsdecomp

## Unity tooling

- **UnityPy** — Unity SerializedFile / AssetBundle reader.
  - License: MIT.
  - https://github.com/K0lb3/UnityPy

No other third-party runtime code is bundled by LocalizationHub in this batch.
License compatibility was verified against the declared upstream licenses; users
redistributing these tools must comply with their respective NOTICE and
attribution requirements.
