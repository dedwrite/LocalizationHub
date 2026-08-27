/*
 * REAL engine extraction integration tests.
 *
 * These drive the SAME pure orchestration used by the desktop "Scan Game" flow
 * (`orchestrateExtraction`) against REAL game archives and REAL external tools
 * (repak / retoc / GDRE / UnityPy helper / UAssetDumper).
 *
 * GATED: they run only when tool + sample paths are supplied via environment
 * variables. They are never part of the default `vitest run` gate.
 *
 *   LH_TOOLS        JSON map of tool paths (repak/retoc/gdre/unitypy/
 *                   unitypyScript/uassetdumper)
 *   LH_SAMPLE_PAK   path to a real Unreal .pak
 *   LH_SAMPLE_UTOC  path to a real Unreal IoStore .utoc (companion .ucas next to it)
 *   LH_SAMPLE_PCK   path to a real/synthetic Godot .pck
 *   LH_SAMPLE_BUNDLE path to a real Unity .bundle / .assets
 *   LH_SAMPLE_UASSET path to a real Unreal .uasset
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  orchestrateExtraction,
  type ExtractionResult,
  type ScanFile,
} from '@localizationhub/core'
import { createNodePrimitives, discoverInput, loadToolsFromEnv, sha256File } from './harness'

const tools = loadToolsFromEnv()

function envPath(key: string): string | undefined {
  const v = process.env[key]
  return v && v.length > 0 ? v : undefined
}

async function runRealExtraction(inputPath: string): Promise<{ result: ExtractionResult; files: ScanFile[] }> {
  const discovery = await discoverInput(inputPath)
  const result = await orchestrateExtraction(discovery, tools, createNodePrimitives(), {
    toolTimeoutMs: 600_000,
  })
  return { result, files: discovery.files }
}

describe('Unreal .pak via repak (real)', () => {
  const pakPath = envPath('LH_SAMPLE_PAK')
  it.skipIf(!pakPath || !tools.repak)('unpacks, discovers, and parses real .locres with source immutability', async () => {
    const before = await sha256File(pakPath!)
    const started = Date.now()

    const { result } = await runRealExtraction(pakPath!)

    const elapsedMs = Date.now() - started
    const after = await sha256File(pakPath!)

    // Source hash MUST remain identical (read-only guarantee).
    expect(after).toBe(before)

    // A real localization pak must surface real entries.
    expect(result.entries.length).toBeGreaterThan(0)
    // Diagnostics should not contain hard errors.
    const hardErrors = result.diagnostics.filter((d) => d.kind === 'parser-error' || d.kind === 'external-tool-failed')
    expect(hardErrors).toEqual([])

    // Logical archive paths only — never the temp dir or absolute drive path.
    for (const e of result.entries) {
      expect(e.sourceLocator?.containerPath ?? '').not.toMatch(/[A-Za-z]:\\|AppData|Temp|\.pak::.*\\/)
    }

    // eslint-disable-next-line no-console
    console.log(
      `[unreal-pak] files=${result.stats.filesScanned} candidates=${result.stats.candidateFiles} entries=${result.entries.length} ` +
        `diagnostics=${result.diagnostics.length} elapsed=${elapsedMs}ms`,
    )
  }, 120_000)
})

describe('Unreal IoStore .utoc via retoc (real)', () => {
  const utocPath = envPath('LH_SAMPLE_UTOC')
  it.skipIf(!utocPath || !tools.retoc)('unpacks a .utoc/.ucas pair and parses resources', async () => {
    const before = await sha256File(utocPath!)
    const { result } = await runRealExtraction(utocPath!)
    const after = await sha256File(utocPath!)

    expect(after).toBe(before)
    // IoStore test containers may or may not carry localizable resources; the
    // key acceptance is that the pair resolves without a tool failure.
    const hardErrors = result.diagnostics.filter((d) => d.kind === 'external-tool-failed')
    expect(hardErrors).toEqual([])

    // eslint-disable-next-line no-console
    console.log(
      `[unreal-iostore] entries=${result.entries.length} diagnostics=${result.diagnostics.length} filesScanned=${result.stats.filesScanned}`,
    )
  }, 120_000)
})

describe('Godot .pck via GDRE (real)', () => {
  const pckPath = envPath('LH_SAMPLE_PCK')
  it.skipIf(!pckPath || !tools.gdre)('extracts a .pck and parses localization resources', async () => {
    const before = await sha256File(pckPath!)
    const { result } = await runRealExtraction(pckPath!)
    const after = await sha256File(pckPath!)

    expect(after).toBe(before)
    expect(result.entries.length).toBeGreaterThan(0)
    const hardErrors = result.diagnostics.filter((d) => d.kind === 'external-tool-failed' || d.kind === 'parser-error')
    expect(hardErrors).toEqual([])

    // eslint-disable-next-line no-console
    console.log(
      `[godot-pck] entries=${result.entries.length} diagnostics=${result.diagnostics.length} filesScanned=${result.stats.filesScanned}`,
    )
  }, 120_000)
})

describe('Unity bundle via UnityPy helper (real)', () => {
  const bundlePath = envPath('LH_SAMPLE_BUNDLE')
  it.skipIf(!bundlePath || !tools.unitypy || !tools.unitypyScript)('loads a bundle, enumerates objects, and extracts TextAssets', async () => {
    const before = await sha256File(bundlePath!)
    const { result } = await runRealExtraction(bundlePath!)
    const after = await sha256File(bundlePath!)

    expect(after).toBe(before)
    // The helper always emits a manifest.json; a real bundle should enumerate
    // at least some objects (or produce a clean manifest + diagnostics).
    const hardErrors = result.diagnostics.filter((d) => d.kind === 'external-tool-failed')
    expect(hardErrors).toEqual([])

    // eslint-disable-next-line no-console
    console.log(
      `[unity-bundle] entries=${result.entries.length} diagnostics=${result.diagnostics.length} filesScanned=${result.stats.filesScanned}`,
    )
  }, 120_000)
})

describe('Unreal .uasset via UAssetDumper (real)', () => {
  const uassetPath = envPath('LH_SAMPLE_UASSET')
  it.skipIf(!uassetPath || !tools.uassetdumper)('converts a .uasset to JSON and parses FText', async () => {
    const before = await sha256File(uassetPath!)
    const { result } = await runRealExtraction(uassetPath!)
    const after = await sha256File(uassetPath!)

    expect(after).toBe(before)
    const hardErrors = result.diagnostics.filter((d) => d.kind === 'external-tool-failed')
    expect(hardErrors).toEqual([])

    // eslint-disable-next-line no-console
    console.log(
      `[unreal-uasset] entries=${result.entries.length} diagnostics=${result.diagnostics.length} filesScanned=${result.stats.filesScanned}`,
    )
  }, 120_000)
})
