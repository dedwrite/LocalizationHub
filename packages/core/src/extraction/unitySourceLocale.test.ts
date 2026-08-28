/*
 * Unity Localization source-locale test.
 *
 * Pins the v0.7 rule: NEVER choose the source/native locale by object-key order.
 * The source locale must come from explicit metadata (SourceLocale / Locale
 * Identifier / SharedTableData), else it is UNKNOWN and the user must choose.
 */

import { describe, expect, it } from 'vitest'
import { extractUnity } from './engines/unity'

function stringTable(table: Record<string, Record<string, string>>, extra: Record<string, unknown> = {}) {
  return extractUnity({ fileName: 'table.json', text: JSON.stringify({ Table: table, ...extra }) })
}

describe('extractUnityStringTable source locale', () => {
  it('uses explicit SourceLocale, NOT the first object key', () => {
    // "fr" is the first key; "en" is declared the source.
    const result = stringTable(
      { fr: { play: 'Jouer' }, en: { play: 'Play' } },
      { SourceLocale: 'en' },
    )
    expect(result.entries[0].sourceLocale).toBe('en')
    expect(result.entries[0].sourceText).toBe('Play')
    expect(result.diagnostics).toHaveLength(0)
  })

  it('uses Locale.Identifier.Code when present', () => {
    const result = stringTable(
      { ja: { play: '遊ぶ' }, en: { play: 'Play' } },
      { Locale: { Identifier: { Code: 'en' } } },
    )
    expect(result.entries[0].sourceLocale).toBe('en')
  })

  it('reports unknown source locale with a warning when no metadata exists', () => {
    const result = stringTable({ fr: { play: 'Jouer' }, en: { play: 'Play' } })
    expect(result.entries).toHaveLength(0) // no source → no entries, no guessing
    expect(result.diagnostics.some((d) => d.kind === 'low-confidence')).toBe(true)
  })
})
