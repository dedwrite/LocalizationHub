/*
 * Second independent Godot sample — Brotato (standard Godot CSV localization).
 *
 * Brotato is a Godot Mod Loader mod using STANDARD Godot CSV localization
 * (`translations_ar.csv` with `keys,en,ar` columns), not Until Then's custom
 * systems. This proves the generic Godot CSV adapter is not overfit to Until
 * Then. Gated by env (never part of the default gate).
 */

import { describe, expect, it } from 'vitest'
import { orchestrateExtraction } from '@localizationhub/core'
import { createNodePrimitives, discoverInput } from './harness'

describe('Brotato (second Godot sample — standard CSV)', () => {
  it.skipIf(!process.env.LH_BROTATO_DIR)('extracts standard Godot CSV localization', async () => {
    const root = process.env.LH_BROTATO_DIR!
    const discovery = await discoverInput(root)
    const result = await orchestrateExtraction(discovery, {}, createNodePrimitives(), {})

    // eslint-disable-next-line no-console
    console.log(
      `[brotato] engine=${result.engine}/${result.detection.confidence} files=${discovery.files.length} ` +
        `entries=${result.entries.length} diagnostics=${result.diagnostics.length}`,
    )

    expect(result.entries.length).toBeGreaterThan(0)
    // The CSV source is English (first locale column), Arabic translation follows.
    const sample = result.entries.find((e) => e.sourceText === 'English')
    expect(sample).toBeTruthy()
  }, 120_000)
})
