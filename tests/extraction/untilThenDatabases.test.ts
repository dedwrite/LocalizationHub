/*
 * Until Then JSON databases — multi-locale aggregation (DEV-ONLY, gated).
 *
 * Scans the real `databases` folder (fb.json + fb_ja.json + …) and asserts the
 * locale variants collapse into ONE logical entry per identity (not 8 copies).
 */

import { describe, expect, it } from 'vitest'
import { orchestrateExtraction } from '@localizationhub/core'
import { createNodePrimitives, discoverInput } from './harness'

describe('Until Then JSON databases (multi-locale)', () => {
  it.skipIf(!process.env.LH_UNTIL_THEN_DB)('collapses locale variants into one logical entry', async () => {
    const root = process.env.LH_UNTIL_THEN_DB!
    const discovery = await discoverInput(root)
    const result = await orchestrateExtraction(discovery, {}, createNodePrimitives(), {})

    const withVariants = result.entries.filter((e) => e.localeVariants && e.localeVariants.length > 0)
    const variantCount = result.entries.reduce((sum, e) => sum + (e.localeVariants?.length ?? 0), 0)

    // eslint-disable-next-line no-console
    console.log(
      `[until-then-db] files=${discovery.files.length} entries=${result.entries.length} ` +
        `withVariants=${withVariants.length} totalVariants=${variantCount} sourceLocales=${[...new Set(result.entries.map((e) => e.sourceLocale).filter(Boolean))].sort().join(',')}`,
    )

    // Real text is extracted (not zero).
    expect(result.entries.length).toBeGreaterThan(0)
    // A meaningful fraction of entries are multi-locale (the 8-locale databases).
    expect(withVariants.length).toBeGreaterThan(0)
    // Every logical entry has a stable culture identity / source locale.
    const multi = result.entries.find((e) => e.localeVariants?.length)
    expect(multi).toBeTruthy()
    expect(multi?.sourceLocale).toBeTruthy()
  }, 300_000)
})
