/*
 * Godot multi-locale normalization tests.
 *
 * Covers:
 *   - locale detection from JSON DB filenames (base vs suffixed)
 *   - locale detection from `.inkb` story paths (`locales/<culture>/…`)
 *   - universal culture aggregation collapsing locale variants into one entry
 *   - source-language override for Godot DB entries
 */

import { describe, expect, it } from 'vitest'
import { detectGodotJsonLocale, detectGodotInkbLocale } from './godotLocales'
import { aggregateCultures, overrideSourceCulture } from './cultureAggregation'
import { extractGodot } from './engines/godot'
import { extractInkb } from './engines/inkb'
import type { ExtractedEntry } from './types'

describe('Godot JSON locale detection', () => {
  it('detects base and locale suffixes', () => {
    expect(detectGodotJsonLocale('fb.json')).toEqual({ baseName: 'fb', isBase: true })
    expect(detectGodotJsonLocale('fb_ja.json')).toEqual({ baseName: 'fb', locale: 'ja', isBase: false })
    expect(detectGodotJsonLocale('fb_zh-CN.json')).toEqual({ baseName: 'fb', locale: 'zh-cn', isBase: false })
    expect(detectGodotJsonLocale('characters_fil.json')).toEqual({ baseName: 'characters', locale: 'fil', isBase: false })
  })

  it('does not treat an ordinary name as locale-suffixed', () => {
    expect(detectGodotJsonLocale('scene_directory.json')).toEqual({ baseName: 'scene_directory', isBase: true })
  })
})

describe('Godot inkb locale detection', () => {
  it('strips the locales/<culture>/ segment', () => {
    expect(detectGodotInkbLocale('f/assets/story/locales/ja/1/1c/1c.inkb')).toEqual({
      locale: 'ja',
      storyPath: '1/1c/1c',
    })
  })

  it('leaves paths without a locales segment intact', () => {
    expect(detectGodotInkbLocale('1/1c/1c.inkb')).toEqual({ storyPath: '1/1c/1c' })
  })
})

describe('Godot JSON database multi-locale aggregation', () => {
  function db(name: string, record: Record<string, unknown>): ExtractedEntry[] {
    const result = extractGodot({ fileName: name, text: JSON.stringify(record) })
    return result.entries
  }

  const base = db('fb.json', { pages: { '5pe3wgdwiyh': { name: 'Princess Sharon Memes', category: 'Actress' } } })
  const ja = db('fb_ja.json', { pages: { '5pe3wgdwiyh': { name: 'プリンセス・シャロン・ミーム', category: '女優' } } })
  const fr = db('fb_fr.json', { pages: { '5pe3wgdwiyh': { name: 'Princesse Sharon Memes', category: 'Actrice' } } })

  it('sets sourceLocale + cultureIdentity on entries', () => {
    expect(base[0].sourceLocale).toBe('en')
    expect(base[0].rawMetadata?.isSourceLocale).toBe(true)
    expect(base[0].cultureIdentity).toContain('godot-db:fb:')
    expect(ja[0].sourceLocale).toBe('ja')
    expect(ja[0].cultureIdentity).toBe(base[0].cultureIdentity)
  })

  it('collapses 3 locale files into ONE logical entry with locale variants', () => {
    const { entries } = aggregateCultures([...base, ...ja, ...fr])
    // 2 fields (name + category) per database → 2 logical entries.
    expect(entries).toHaveLength(2)

    const nameEntry = entries.find((e) => e.sourceText.includes('Sharon'))
    expect(nameEntry).toBeTruthy()
    // English base is the source.
    expect(nameEntry?.sourceText).toBe('Princess Sharon Memes')
    expect(nameEntry?.sourceLocale).toBe('en')
    // ja and fr preserved as variants.
    expect(nameEntry?.localeVariants?.map((v) => v.locale).sort()).toEqual(['fr', 'ja'])
  })

  it('source-language override switches source text for Godot DB entries', () => {
    const { entries } = aggregateCultures([...base, ...ja, ...fr])
    const overridden = overrideSourceCulture(entries, 'fr')
    const nameEntry = overridden.find((e) => e.sourceText.includes('Princesse'))
    expect(nameEntry).toBeTruthy()
    expect(nameEntry?.sourceLocale).toBe('fr')
    expect(nameEntry?.localeVariants?.map((v) => v.locale).sort()).toEqual(['en', 'ja'])
  })
})

describe('inkb locale-independent identity', () => {
  it('strips locale from story identity', () => {
    const ja = extractInkb('story/locales/ja/1/1c/1c.inkb', buildInkb(['type: "dialogue"', 'characters: { "Mark": "MarkBorja" }', 'player: "Mark"', 'Mark: Hello']))
    const fr = extractInkb('story/locales/fr/1/1c/1c.inkb', buildInkb(['type: "dialogue"', 'characters: { "Mark": "MarkBorja" }', 'player: "Mark"', 'Mark: Bonjour']))

    // Same story path → same culture identity, different sourceLocale.
    expect(ja.entries[0].cultureIdentity).toBe(fr.entries[0].cultureIdentity)
    expect(ja.entries[0].sourceLocale).toBe('ja')
    expect(fr.entries[0].sourceLocale).toBe('fr')
    expect(ja.entries[0].context?.scene).toBe('1/1c/1c')

    // Aggregation collapses them into one logical entry.
    const { entries } = aggregateCultures([...ja.entries, ...fr.entries])
    expect(entries).toHaveLength(1)
    expect(entries[0].localeVariants).toHaveLength(1)
  })
})

function buildInkb(strings: string[]): Uint8Array {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const header = new Uint8Array(10)
  header[0] = 0x01
  header[1] = 0x00
  header[2] = 0x14
  parts.push(header)
  for (const s of strings) {
    parts.push(encoder.encode(s))
    parts.push(new Uint8Array([0x00]))
  }
  parts.push(new Uint8Array([0x4e, 0x4f, 0x50, 0x00, 0xff, 0xfe]))
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}
