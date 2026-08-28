/*
 * Godot `.inkb` cross-locale alignment tests.
 *
 * These pin the behaviours required by the real-game acceptance:
 *   - line-level alignment (never story-wide all-or-nothing)
 *   - container-prefixed path normalization (`UntilThen.pck::assets/story/...`)
 *   - split/merged/omitted lines isolate safely and resynchronize afterward
 *   - source-culture switching and project-row counts
 *   - localeVariants survive Project V3 serialization
 */

import { describe, expect, it } from 'vitest'
import { extractInkb } from './engines/inkb'
import { extractGodot } from './engines/godot'
import { aggregateCultures, overrideSourceCulture } from './cultureAggregation'
import { alignInkbStories } from './inkbAlignment'
import { detectGodotInkbLocale } from './godotLocales'
import { buildProjectFromExtraction } from './projectFromExtraction'
import type { ExtractionResult } from './types'

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

const HEADER = ['type: "dialogue"', 'characters: { "Mark": "MarkBorja", "Ryan": "RyanSoriano", "Louise": "LouiseReyes" }', 'player: "Mark"']

function story(containerPath: string, dialogue: string[]): ExtractionResult {
  return extractInkb(containerPath, buildInkb([...HEADER, ...dialogue]))
}

/*
 * The §35 fixture:
 *   EN: A1 A2 A3 A4 A5
 *   FR: A1 A2    A4 A5   (A3 omitted)
 *   DE: A1 A2 S1 S2 A4 A5 (A3 split into two)
 *   JA: A1 A2 A3 A4 A5   (identical)
 */
function enStory(): ExtractionResult {
  return story('assets/story/10/10/$.inkb', [
    'Mark: A1', 'Mark: A2', 'Ryan: A3', 'Louise: A4', 'Mark: A5',
  ])
}
function frStory(): ExtractionResult {
  return story('assets/story/locales/fr/10/10/$.inkb', [
    'Mark: FA1', 'Mark: FA2', 'Louise: FA4', 'Mark: FA5',
  ])
}
function deStory(): ExtractionResult {
  return story('assets/story/locales/de/10/10/$.inkb', [
    'Mark: DA1', 'Mark: DA2', 'Ryan: DS1', 'Ryan: DS2', 'Louise: DA4', 'Mark: DA5',
  ])
}
function jaStory(): ExtractionResult {
  return story('assets/story/locales/ja/10/10/$.inkb', [
    'Mark: JA1', 'Mark: JA2', 'Ryan: JA3', 'Louise: JA4', 'Mark: JA5',
  ])
}

describe('inkb container-path locale detection', () => {
  it('normalizes real container-prefixed paths to one storyPath', () => {
    const base = detectGodotInkbLocale('UntilThen.pck::assets/story/10/10/$.inkb')
    const de = detectGodotInkbLocale('UntilThen.pck::assets/story/locales/de/10/10/$.inkb')
    const zh = detectGodotInkbLocale('UntilThen.pck::assets/story/locales/zh-CN/10/10/$.inkb')

    expect(base.storyPath).toBe('10/10/$')
    expect(base.isBase).toBe(true)
    expect(de).toEqual({ locale: 'de', storyPath: '10/10/$' })
    expect(zh.storyPath).toBe('10/10/$')
    expect(zh.locale).toBe('zh-cn')
  })
})

describe('inkb line-level alignment', () => {
  it('aligns a split/omit fixture without mispairing (resynchronizes after divergence)', () => {
    const all = [...enStory().entries, ...frStory().entries, ...deStory().entries, ...jaStory().entries]
    const { entries, mismatchStories } = alignInkbStories(all)

    // 5 base lines: A1 A2 A3 A4 A5.
    const logical = entries.filter((e) => e.context?.speaker !== undefined || e.sourceText.startsWith('A'))
    const enEntries = entries.filter((e) => e.sourceText.startsWith('A'))

    // A1, A2, A4, A5 merge across all locales; A3 is omitted in FR and split in DE.
    const a1 = enEntries.find((e) => e.sourceText === 'A1')!
    const a2 = enEntries.find((e) => e.sourceText === 'A2')!
    const a3 = enEntries.find((e) => e.sourceText === 'A3')!
    const a4 = enEntries.find((e) => e.sourceText === 'A4')!
    const a5 = enEntries.find((e) => e.sourceText === 'A5')!

    // Identical locale (ja) aligns 1:1 for every line.
    expect(a1.localeVariants?.map((v) => v.locale).sort()).toEqual(['de', 'fr', 'ja'])
    expect(a2.localeVariants?.map((v) => v.locale).sort()).toEqual(['de', 'fr', 'ja'])
    // A4/A5 also have all three locales (the divergence resynchronized).
    expect(a4.localeVariants?.map((v) => v.locale).sort()).toEqual(['de', 'fr', 'ja'])
    expect(a5.localeVariants?.map((v) => v.locale).sort()).toEqual(['de', 'fr', 'ja'])

    // A3 is omitted in FR → FR is not a variant of A3 (no wrong pairing).
    expect(a3.localeVariants?.map((v) => v.locale) ?? []).toEqual(['ja'])
    expect(a3.localeVariants?.some((v) => v.locale === 'fr')).toBe(false)

    // The DE split (A3 → DS1 + DS2) is isolated, never attached to A3 as a pair.
    const deSplit = entries.filter((e) => e.rawMetadata?.alignmentExtra === true)
    expect(deSplit.map((e) => e.sourceText).sort()).toEqual(['DS1', 'DS2'])
    expect(deSplit.every((e) => e.sourceLocale === 'de')).toBe(true)

    // The story is reported as a structural mismatch with unmatched lines.
    expect(mismatchStories).toHaveLength(1)
    expect(mismatchStories[0].storyPath).toBe('10/10/$')
    expect(mismatchStories[0].unmatchedLocale).toBe(2) // DS1 + DS2 extra in DE

    expect(logical.length).toBeGreaterThanOrEqual(5)
  })

  it('merges identical stories with the fast path and no mismatches', () => {
    const en = enStory().entries
    const ja = jaStory().entries
    const { entries, mismatchStories } = alignInkbStories([...en, ...ja])
    expect(entries).toHaveLength(5)
    expect(mismatchStories).toHaveLength(0)
    expect(entries.every((e) => e.sourceLocale === 'en')).toBe(true)
    expect(entries.every((e) => e.localeVariants?.length === 1)).toBe(true)
  })
})

describe('aggregateCultures inkb routing', () => {
  it('collapses inkb locale copies through line alignment', () => {
    const all = [...enStory().entries, ...jaStory().entries, ...frStory().entries]
    const { entries } = aggregateCultures(all)
    // 5 logical base lines (A3 has no fr variant but still one logical entry).
    expect(entries).toHaveLength(5)
    const a3 = entries.find((e) => e.sourceText === 'A3')!
    expect(a3.sourceLocale).toBe('en')
    expect(a3.localeVariants?.map((v) => v.locale).sort()).toEqual(['ja'])
  })

  it('preserves JSON database aggregation alongside inkb', () => {
    const en = enStory().entries
    const ja = jaStory().entries
    const dbBase = extractGodot({ fileName: 'fb.json', text: JSON.stringify({ pages: { x: { name: 'Name' } } }) }).entries
    const dbJa = extractGodot({ fileName: 'fb_ja.json', text: JSON.stringify({ pages: { x: { name: '名前' } } }) }).entries
    const { entries } = aggregateCultures([...en, ...ja, ...dbBase, ...dbJa])
    const dbLogical = entries.filter((e) => e.cultureIdentity?.startsWith('godot-db:'))
    expect(dbLogical).toHaveLength(1)
    expect(dbLogical[0].sourceText).toBe('Name')
    expect(dbLogical[0].localeVariants?.map((v) => v.locale)).toEqual(['ja'])
  })
})

describe('source-culture switching after alignment', () => {
  it('switches source to ja and keeps en as a variant, identity unchanged', () => {
    const all = [...enStory().entries, ...jaStory().entries]
    const { entries } = aggregateCultures(all)
    const a1 = entries.find((e) => e.sourceText === 'A1')!
    const identity = a1.cultureIdentity
    const id = a1.id

    const switched = overrideSourceCulture(entries, 'ja')
    const a1Ja = switched.find((e) => e.id === id)!
    expect(a1Ja.sourceText).toBe('JA1')
    expect(a1Ja.sourceLocale).toBe('ja')
    expect(a1Ja.cultureIdentity).toBe(identity)
    expect(a1Ja.localeVariants?.map((v) => v.locale)).toEqual(['en'])
  })
})

describe('project creation from aligned inkb', () => {
  it('produces one project row per logical identity (not per locale)', () => {
    const all = [...enStory().entries, ...frStory().entries, ...deStory().entries, ...jaStory().entries]
    const { entries } = aggregateCultures(all)
    // 5 base lines + 2 isolated DE split fragments.
    const project = buildProjectFromExtraction(
      { ...enStory(), entries },
      'extracted-game.json',
    )
    expect(project.entries).toHaveLength(entries.length)
    // Locale variants are not separate rows.
    expect(project.entries.length).toBeLessThan(all.length)
  })
})
