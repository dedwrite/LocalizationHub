/*
 * Until Then — REAL Godot acceptance corpus (DEV-ONLY, gated by env).
 *
 * The human acceptance target for the Godot pipeline. Scans the real recovered
 * Until Then project (scene/script/database folders) and asserts that the SAME
 * input that previously produced 0 entries now produces meaningful text.
 *
 * GATED: runs only when LH_UNTIL_THEN_DIR points at a real game folder. It is
 * never part of the default `vitest run` gate, and no copyrighted game files
 * are committed — only counts/assertions.
 */

import { describe, expect, it } from 'vitest'
import { orchestrateExtraction } from '@localizationhub/core'
import { createNodePrimitives, discoverInput } from './harness'

describe('Until Then (real Godot corpus)', () => {
  it.skipIf(!process.env.LH_UNTIL_THEN_DIR)('extracts real text from the recovered project', async () => {
    const root = process.env.LH_UNTIL_THEN_DIR!
    const discovery = await discoverInput(root)
    const result = await orchestrateExtraction(discovery, {}, createNodePrimitives(), {})

    // eslint-disable-next-line no-console
    console.log(
      `[until-then] engine=${result.engine}/${result.detection.confidence} resources=${discovery.files.length} ` +
        `entries=${result.entries.length} diagnostics=${result.diagnostics.length} ` +
        `dialogue=${result.stats.byClassification['Dialogue'] ?? 0} ui=${(result.stats.byClassification['UI'] ?? 0) + (result.stats.byClassification['Menu'] ?? 0)}`,
    )

    // The real game MUST produce meaningful text (not the previous 0).
    expect(result.entries.length).toBeGreaterThan(0)
    // Engine must be Godot, HIGH confidence given the resource volume.
    expect(result.engine).toBe('godot')
    // Diagnostics must be aggregated (a handful of cards, not tens of thousands).
    expect(result.diagnostics.length).toBeLessThan(50)
  }, 300_000)
})
