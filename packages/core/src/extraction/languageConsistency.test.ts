/*
 * Language-consistency proof.
 *
 * Until Then has a MIXED source situation: the recovered JSON databases have an
 * English base + 7 translated variants, while the story `.inkb` corpus only
 * ships `ja`. The runtime (Story.gd) confirms `DEFAULT_LOCALE = "en"` with base
 * stories at `res://assets/story/<story>.inkb`, and localized overlays at
 * `res://assets/story/locales/<locale>/<story>.inkb` — the English base story
 * is simply absent from this recovered developer snapshot.
 *
 * These tests prove the pipeline NEVER lies about locale: story entries are
 * `ja`, database entries are `en` (+ variants), and no `ja` string is ever
 * labeled `en`.
 */

import { describe, expect, it } from 'vitest'
import { extractInkb } from './engines/inkb'
import { extractGodot } from './engines/godot'
import { computeLocaleCoverage } from './cultureAggregation'

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

describe('Until Then language consistency', () => {
  it('labels the story locale from the locales/<culture>/ path (ja, not en)', () => {
    const ja = extractInkb('story/locales/ja/1/1c/1c.inkb', buildInkb(['type: "dialogue"', 'characters: { "Mark": "MarkBorja" }', 'player: "Mark"', 'Mark: こんにちは']))
    expect(ja.entries[0].sourceLocale).toBe('ja')
    expect(ja.entries[0].sourceLocale).not.toBe('en')
  })

  it('labels the database source as English (unsuffixed base)', () => {
    const en = extractGodot({ fileName: 'fb.json', text: JSON.stringify({ pages: { x: { name: 'Princess Sharon' } } }) })
    expect(en.entries[0].sourceLocale).toBe('en')
    expect(en.entries[0].rawMetadata?.isSourceLocale).toBe(true)
  })

  it('never mixes ja story text into an English source entry', () => {
    const ja = extractInkb('story/locales/ja/1/1c/1c.inkb', buildInkb(['type: "dialogue"', 'characters: { "Mark": "MarkBorja" }', 'player: "Mark"', 'Mark: こんにちは']))
    const en = extractGodot({ fileName: 'fb.json', text: JSON.stringify({ pages: { x: { name: 'Princess Sharon' } } }) })
    const coverage = computeLocaleCoverage([...ja.entries, ...en.entries])
    // en has source coverage (DB) but ja has source coverage (story) — the two
    // are distinct, never blended.
    expect(coverage['en'].source).toBe(1)
    expect(coverage['ja'].source).toBe(1)
    expect(coverage['ja'].available).toBe(1)
  })

  it('reports missing-locale reality: a ja-only story has no en variant', () => {
    const ja = extractInkb('story/locales/ja/1/1c/1c.inkb', buildInkb(['type: "dialogue"', 'characters: { "Mark": "MarkBorja" }', 'player: "Mark"', 'Mark: こんにちは']))
    const coverage = computeLocaleCoverage(ja.entries)
    expect(coverage['en']).toBeUndefined() // no English story in this snapshot
    expect(coverage['ja']?.source).toBe(1)
  })
})
