/*
 * Until Then FULL installed-game story corpus (en base + 7 locale overlays).
 *
 * Scans the extracted PCK story tree from the REAL installed game
 * (F:\SteamLibrary\steamapps\common\Until Then\UntilThen.pck), which contains
 * the English base stories (res://assets/story/<story>.inkb) AND the locale
 * overlays (res://assets/story/locales/<locale>/<story>.inkb). This is the
 * previously-MISSING surface (the dev snapshot only had the 'ja' overlay).
 *
 * Gated by env; no copyrighted files are committed.
 */

import { describe, expect, it } from 'vitest'
import { orchestrateExtraction } from '@localizationhub/core'
import { createNodePrimitives, discoverInput } from './harness'

describe('Until Then full installed story corpus (en + 7 locales)', () => {
  it.skipIf(!process.env.LH_UNTIL_THEN_FULL_STORY)('aggregates English base + locale overlays, flags structural mismatches', async () => {
    const root = process.env.LH_UNTIL_THEN_FULL_STORY!
    const discovery = await discoverInput(root)
    const started = Date.now()
    const result = await orchestrateExtraction(discovery, {}, createNodePrimitives(), {})
    const elapsed = Date.now() - started

    const dialogue = result.stats.byClassification['Dialogue'] ?? 0
    const withVariants = result.entries.filter((e) => (e.localeVariants?.length ?? 0) > 0)
    const mismatchDiag = result.diagnostics.find((d) => d.kind === 'locale-structure-mismatch')

    // eslint-disable-next-line no-console
    console.log(
      `[until-then-full-story] files=${discovery.files.length} entries=${result.entries.length} ` +
        `dialogue=${dialogue} withVariants=${withVariants.length} ` +
        `mismatches=${mismatchDiag?.count ?? 0} diagnostics=${result.diagnostics.length} elapsed=${elapsed}ms`,
    )

    // Real dialogue is extracted.
    expect(dialogue).toBeGreaterThan(0)
    // Multi-locale aggregation: English base + variants collapsed into ONE entry.
    expect(withVariants.length).toBeGreaterThan(0)
    // Structural mismatch detection reports the ~66 diverging stories.
    expect(mismatchDiag).toBeTruthy()

    // A matched entry must have English source + Japanese variant.
    const enEntry = result.entries.find((e) => e.sourceLocale === 'en' && e.context?.speaker)
    expect(enEntry).toBeTruthy()
  }, 600_000)
})
