/*
 * DISCOVERY PARITY CONTRACT — core vs native discovery.
 *
 * The desktop "Scan Game" flow discovers files with the Rust `scan_directory`
 * command (src-tauri/src/scan.rs). If a file type is recognized by core but
 * dropped by native discovery, localizable content is silently lost. The two
 * regressions this guards against are:
 *
 *   - `.inkb` absent from CANDIDATE_EXTENSIONS → Dialogue = 0
 *   - `.gdc` absent from CANDIDATE_EXTENSIONS → binary .gdc never reported
 *
 * The full layer-by-layer matrix is documented below; this test asserts the
 * core side is internally consistent and that every routeable extension maps
 * to a parser (or an archive job). A counterpart Rust test
 * (`scan.rs::tests::native_discovery_covers_every_core_routeable_extension`)
 * asserts the native side.
 */

import { describe, expect, it } from 'vitest'
import {
  classifyFileKind,
  TEXT_EXTENSIONS,
  SCRIPT_EXTENSIONS,
  UNREAL_BINARY_EXTENSIONS,
  GODOT_BINARY_RESOURCE_EXTENSIONS,
  INKB_STORY_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  STRUCTURAL_EXTENSIONS,
} from './scanGame'
import { buildArchivePlan } from './orchestrate'
import type { ScanFile } from './scanGame'

function file(name: string): ScanFile {
  return { name, relativePath: name, absolutePath: `/tmp/${name}`, size: 0 }
}

describe('discovery parity matrix', () => {
  it('no extension is classified by two different core buckets', () => {
    const buckets: Array<[string, ReadonlySet<string>]> = [
      ['text', TEXT_EXTENSIONS],
      ['script', SCRIPT_EXTENSIONS],
      ['unreal-binary', UNREAL_BINARY_EXTENSIONS],
      ['godot-binary', GODOT_BINARY_RESOURCE_EXTENSIONS],
      ['inkb-story', INKB_STORY_EXTENSIONS],
      ['archive', ARCHIVE_EXTENSIONS],
      ['structural', STRUCTURAL_EXTENSIONS],
    ]
    const seen = new Map<string, string>()
    for (const [label, set] of buckets) {
      for (const ext of set) {
        const previous = seen.get(ext)
        expect(previous, `extension ${ext} in both ${previous} and ${label}`).toBeUndefined()
        seen.set(ext, label)
      }
    }
  })

  it('every routeable extension maps to a non-unknown kind', () => {
    // Extensions scanGame classifies directly (loose files).
    const scanGameSets = [
      ...TEXT_EXTENSIONS,
      ...SCRIPT_EXTENSIONS,
      ...UNREAL_BINARY_EXTENSIONS,
      ...GODOT_BINARY_RESOURCE_EXTENSIONS,
      ...INKB_STORY_EXTENSIONS,
      ...ARCHIVE_EXTENSIONS,
    ]
    for (const ext of scanGameSets) {
      const kind = classifyFileKind(file(`sample${ext}`))
      expect(kind, `.${ext.slice(1)} must not classify as "unknown"`).not.toBe('unknown')
    }
    // Archive-job companions are routed by the orchestrator, not scanGame.
    for (const ext of ['.uasset', '.uexp', '.ubulk']) {
      const tools = { repak: 'x', retoc: 'x', gdre: 'x', unitypy: 'x', unitypyScript: 'x', uassetdumper: 'x' }
      const plan = buildArchivePlan([file(`sample${ext}`)], tools)
      // .uexp/.ubulk need their .uasset sibling; .uasset alone produces a job.
      const withPrimary = ext === '.uasset'
        ? plan.jobs.length > 0
        : buildArchivePlan([file('a.uasset'), file(`a${ext}`)], tools).jobs.length === 1
      expect(withPrimary, `${ext} should be routed by the orchestrator, not lost`).toBe(true)
    }
  })

  it('inkb and gdc are classified for the parser, not dropped', () => {
    expect(classifyFileKind(file('story.inkb'))).toBe('inkb-story')
    expect(classifyFileKind(file('shader.gdc'))).toBe('godot-binary')
  })

  it('every primary archive extension is routed by buildArchivePlan', () => {
    const tools = { repak: 'x', retoc: 'x', gdre: 'x', unitypy: 'x', unitypyScript: 'x', uassetdumper: 'x' }
    for (const name of ['sample.pak', 'sample.utoc', 'sample.pck', 'resources.assets', 'sample.unity3d', 'sample.bundle', 'sample.uasset']) {
      const plan = buildArchivePlan([file(name)], tools)
      expect(plan.jobs.length, `${name} should produce an archive job`).toBeGreaterThan(0)
    }
  })

  it('companion containers (.ucas/.uexp/.ubulk) are handled via their primary', () => {
    const tools = { repak: 'x', retoc: 'x', gdre: 'x', unitypy: 'x', unitypyScript: 'x', uassetdumper: 'x' }
    // .ucas is unpacked together with its .utoc (one retoc job, no double report).
    const ioStore = buildArchivePlan([file('pak.utoc'), file('pak.ucas')], tools)
    expect(ioStore.jobs).toHaveLength(1)
    // .uexp/.ubulk are read by UAssetAPI alongside their .uasset.
    const uasset = buildArchivePlan([file('asset.uasset'), file('asset.uexp'), file('asset.ubulk')], tools)
    expect(uasset.jobs).toHaveLength(1)
  })
})

/*
 * AUTHORITATIVE MATRIX (documentation).
 *
 * FORMAT                      NATIVE?  CORE CLASS?        ADAPTER            ORCHESTRATOR              STATUS
 * ─────────────────────────── ──────── ────────────────── ────────────────── ───────────────────────── ──────────────────────────
 * Unreal .locres/.locmeta     yes      unreal-binary      locres/locmeta     loose                     SUPPORTED (native reader)
 * Unreal .pak                 yes      archive            repak              external-tool job         EXTERNAL TOOL REQUIRED
 * Unreal .utoc/.ucas          yes      archive            retoc              external-tool job         EXTERNAL TOOL REQUIRED
 * Unreal .uasset/.uexp/.ubulk yes      (orchestrator)     uassetdumper       external-tool job         PARTIAL (UE5 fails)
 * Godot  .pck                 yes      archive            gdre               external-tool job         EXTERNAL TOOL REQUIRED
 * Godot  project.godot        yes      structural         (detection only)   skipped                   DETECTED ONLY
 * Godot  .tscn/.tres          yes      text-resource      extractGodotScene  loose                     SUPPORTED
 * Godot  .gd                  yes      script             extractGodotScript loose                     SUPPORTED
 * Godot  .gdc                 yes      godot-binary       (delegated)        grouped diagnostic        DETECTED ONLY (needs convert)
 * Godot  .res/.scn/.translation yes    godot-binary       (delegated)        grouped diagnostic        PARTIAL (OptimizedTranslation)
 * Godot  .inkb                yes      inkb-story         extractInkb        loose                     SUPPORTED
 * Godot  .ink                 yes      text-resource      extractInk         loose                     SUPPORTED
 * Godot  .json/.csv           yes      text-resource      extractGodot       loose                     SUPPORTED
 * Godot  .po/.pot             yes      text-resource      extractPo          loose                     SUPPORTED
 * Unity  .assets/.bundle      yes      archive            unitypy            external-tool job         EXTERNAL TOOL REQUIRED
 * Unity  .unity3d             yes      archive            unitypy            external-tool job         EXTERNAL TOOL REQUIRED
 * Unity  extensionless        yes      archive            unitypy            external-tool job         EXTERNAL TOOL REQUIRED
 *   (globalgamemanagers, level*, sharedassets*.assets)
 *
 * Structural sidecars (.import/.remap/.uid/.md5/.meta/.cfg) are intentionally
 * NOT discovered by native scan_directory (they are never localizable and
 * discovering them would only add noise); core classifies them "structural" so
 * any that DO arrive (e.g. via Node harness) are skipped without a read.
 */
