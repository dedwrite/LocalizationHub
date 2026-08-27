/*
 * Until Then `.inkb` real-corpus acceptance (DEV-ONLY, gated by env).
 *
 * Scans the real compiled story directory and asserts meaningful story
 * dialogue is extracted from the `.inkb` files (the previously 0-dialogue
 * surface). No copyrighted files are committed — only counts/assertions.
 */

import { describe, expect, it } from 'vitest'
import { orchestrateExtraction } from '@localizationhub/core'
import { createNodePrimitives, discoverInput } from './harness'

describe('Until Then .inkb (real story corpus)', () => {
  it.skipIf(!process.env.LH_UNTIL_THEN_INKB)('extracts story dialogue from compiled .inkb', async () => {
    const root = process.env.LH_UNTIL_THEN_INKB!
    const discovery = await discoverInput(root)
    const started = Date.now()
    const result = await orchestrateExtraction(discovery, {}, createNodePrimitives(), {})
    const elapsed = Date.now() - started

    const dialogue = result.stats.byClassification['Dialogue'] ?? 0

    // eslint-disable-next-line no-console
    console.log(
      `[until-then-inkb] engine=${result.engine}/${result.detection.confidence} ` +
        `files=${discovery.files.length} entries=${result.entries.length} dialogue=${dialogue} ` +
        `withSpeaker=${result.stats.entriesWithSpeaker} diagnostics=${result.diagnostics.length} elapsed=${elapsed}ms`,
    )

    // The real story corpus MUST produce dialogue (not the previous 0).
    expect(result.entries.length).toBeGreaterThan(0)
    expect(dialogue).toBeGreaterThan(0)
    expect(result.stats.entriesWithSpeaker).toBeGreaterThan(0)
  }, 300_000)
})
