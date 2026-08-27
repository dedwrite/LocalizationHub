/*
 * Until Then `.inkb` story reader tests.
 *
 * The `.inkb` format is Until Then's custom serialization (NOT upstream InkCPP
 * binary): a 10-byte header, NUL-terminated strings (metadata + `$` commands +
 * `char_key: text` dialogue), then a binary command tail we ignore.
 */

import { describe, expect, it } from 'vitest'
import { extractInkb, readInkbTextStrings, parseInkbMetadata } from './engines/inkb'

/*
 * Build a synthetic `.inkb` buffer matching the real layout:
 *   u16 version=1, u32=20, u32=0, then NUL-terminated strings, then a binary tail.
 */
function buildInkb(strings: string[]): Uint8Array {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []

  // 10-byte header: u16=1, u32=20, u32=0 (little-endian).
  const header = new Uint8Array(10)
  header[0] = 0x01
  header[1] = 0x00
  header[2] = 0x14
  parts.push(header)

  for (const s of strings) {
    parts.push(encoder.encode(s))
    parts.push(new Uint8Array([0x00]))
  }

  // Binary tail: a `NOP` marker + garbage.
  parts.push(new Uint8Array([0x4e, 0x4f, 0x50, 0x00, 0x00, 0xff, 0xff, 0xfe, 0xfd]))

  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

describe('inkb text-string reader', () => {
  it('reads NUL-terminated strings and stops at the binary tail', () => {
    const strings = readInkbTextStrings(buildInkb(['type: "chat"', '$ pass', 'Mark: Hello', 'Ryan: Hi']))
    expect(strings).toEqual(['type: "chat"', '$ pass', 'Mark: Hello', 'Ryan: Hi'])
  })

  it('stops at the NOP marker', () => {
    const strings = readInkbTextStrings(buildInkb(['type: "scene"', '$ fade_in']))
    expect(strings).toEqual(['type: "scene"', '$ fade_in'])
  })
})

describe('inkb metadata', () => {
  it('parses type/characters/player', () => {
    const meta = parseInkbMetadata([
      'type: "chat"',
      'characters: { "Mark": "MarkBorja", "Ryan": "RyanSoriano" }',
      'player: "Mark"',
      '$ pass',
    ])
    expect(meta.type).toBe('chat')
    expect(meta.characters).toEqual({ Mark: 'MarkBorja', Ryan: 'RyanSoriano' })
    expect(meta.player).toBe('Mark')
  })
})

describe('inkb dialogue extraction', () => {
  it('extracts dialogue with speaker + character id + scene context', () => {
    const buffer = buildInkb([
      'type: "dialogue"',
      'characters: { "Mark": "MarkBorja" }',
      'player: "Mark"',
      '$ pass',
      'Mark: Where have you been?',
      'Mark: I was worried.',
      ':: (inner thought)',
    ])
    const result = extractInkb('ch1/1c.inkb', buffer)

    expect(result.entries).toHaveLength(3)
    expect(result.entries[0].sourceText).toBe('Where have you been?')
    expect(result.entries[0].classification).toBe('Dialogue')
    expect(result.entries[0].context?.speaker).toBe('Mark')
    expect(result.entries[0].context?.speakerId).toBe('MarkBorja')
    expect(result.entries[0].context?.scene).toBe('ch1/1c')
    expect(result.entries[0].context?.conversationId).toBe('inkb:ch1/1c')

    // Thought ("char_key == ':'") has no speaker.
    expect(result.entries[2].context?.speaker).toBeUndefined()
    expect(result.entries[2].rawMetadata?.isThought).toBe(true)
    expect(result.entries[2].sourceText).toBe('(inner thought)')
  })

  it('skips $ commands and metadata strings', () => {
    const buffer = buildInkb([
      'type: "dialogue"',
      'characters: { "Mark": "MarkBorja" }',
      'player: "Mark"',
      '$ play_anim Mark notice',
      '$ wait 1',
      'Mark: Hello',
    ])
    const result = extractInkb('1a.inkb', buffer)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].sourceText).toBe('Hello')
  })

  it('protects control markers [.] [..] [$cmd]', () => {
    const buffer = buildInkb([
      'type: "dialogue"',
      'characters: { "Mark": "MarkBorja" }',
      'player: "Mark"',
      'Mark: [.]Hello[..]there',
    ])
    const result = extractInkb('1a.inkb', buffer)
    const raws = result.entries[0].protectedSegments.map((s) => s.raw)
    expect(raws).toContain('[.]')
    expect(raws).toContain('[..]')
  })

  it('preserves distinct identity for identical lines in different nodes', () => {
    const a = extractInkb('1a.inkb', buildInkb(['type: "dialogue"', 'characters: { "M": "M" }', 'player: "M"', 'M: Okay.']))
    const b = extractInkb('2b.inkb', buildInkb(['type: "dialogue"', 'characters: { "M": "M" }', 'player: "M"', 'M: Okay.']))
    expect(a.entries[0].id).not.toBe(b.entries[0].id)
  })

  it('tolerates an unrecognized binary (no crash, zero entries)', () => {
    const garbage = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x01, 0x02])
    const result = extractInkb('x.inkb', garbage)
    expect(result.entries).toHaveLength(0)
  })

  it('attributes bare continuation lines to the previous speaker', () => {
    const buffer = buildInkb([
      'type: "dialogue"',
      'characters: { "Mark": "MarkBorja", "Ryan": "RyanSoriano" }',
      'player: "Mark"',
      'Ryan: 当ててみようか',
      'ピンポーン！',
      'Mark: ピンポーン！',
    ])
    const result = extractInkb('1/1c/1c.inkb', buffer)
    expect(result.entries).toHaveLength(3)
    // Continuation inherits Ryan as speaker.
    expect(result.entries[1].sourceText).toBe('ピンポーン！')
    expect(result.entries[1].context?.speaker).toBe('Ryan')
    expect(result.entries[1].context?.speakerId).toBe('RyanSoriano')
    expect(result.entries[1].rawMetadata?.continuation).toBe(true)
  })

  it('skips bare identifiers (story labels), not text', () => {
    const buffer = buildInkb([
      'type: "dialogue"',
      'characters: { "Mark": "MarkBorja" }',
      'player: "Mark"',
      'Mark: 降参だ。',
      'music_end',
      'bgg75cdd4i5',
    ])
    const result = extractInkb('1/2/1d.inkb', buffer)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].sourceText).toBe('降参だ。')
  })

  it('tracks $ F <char> focus commands for implicit speaker', () => {
    const buffer = buildInkb([
      'type: "dialogue"',
      'characters: { "Mark": "MarkBorja" }',
      'player: "Mark"',
      '$ F MarkBorja default',
      'こんにちは。',
    ])
    const result = extractInkb('x.inkb', buffer)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].context?.speaker).toBe('MarkBorja')
  })
})
