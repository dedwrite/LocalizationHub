/*
 * Until Then `.inkb` story reader tests.
 *
 * The `.inkb` format is Until Then's custom serialization (NOT upstream InkCPP
 * binary): a 10-byte header, NUL-terminated strings (metadata + `$` commands +
 * `char_key: text` dialogue), then a binary command tail we ignore.
 */

import { describe, expect, it } from 'vitest'
import { extractInkb, inferInkbListeners, readInkbTextStrings, parseInkbMetadata } from './engines/inkb'
import { inferContextFromRecord } from './contextInference'

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

  it('extracts timed player choices from $ push_timed_choices', () => {
    const buffer = buildInkb([
      'type: "dialogue"',
      'characters: { "Mark": "MarkBorja" }',
      'player: "Mark"',
      '$ push_timed_choices 4.0 0',
      '(Get it!)',
      '(Run away!)',
      '$ wait 0.5',
      'Mark: I grabbed it.',
    ])
    const result = extractInkb('1d.inkb', buffer)
    const choices = result.entries.filter((e) => e.classification === 'Choice')
    expect(choices.map((c) => c.sourceText)).toEqual(['Get it!', 'Run away!'])
    expect(choices.every((c) => c.rawMetadata?.timedChoice === true)).toBe(true)
    // The dialogue after the choice block is still extracted.
    expect(result.entries.some((e) => e.classification === 'Dialogue' && e.sourceText === 'I grabbed it.')).toBe(true)
    // Choices are NOT misclassified as narration dialogue.
    expect(result.entries.some((e) => e.classification === 'Dialogue' && e.sourceText === 'Get it!')).toBe(false)
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

describe('conservative INKB listeners (synthetic dialogue)', () => {
  const characters = { Ada: 'actor-a', Bo: 'actor-b' }
  const extract = (lines: string[], cast: Record<string, string> = characters, player?: string) => extractInkb('synthetic/hall.inkb', buildInkb([
    'type: "dialogue"', `characters: ${JSON.stringify(cast)}`,
    ...(player ? [`player: ${JSON.stringify(player)}`] : []), '$ pass', ...lines,
  ]))

  it('infers the opposite participant once per turn, including continuation, with accurate stats', () => {
    const result = extract(['Ada: Test greeting.', 'A second test sentence.', 'Bo: Test reply.'])
    expect(result.entries.map((e) => e.context?.listener)).toEqual(['Bo', 'Bo', 'Ada'])
    expect(result.entries.map((e) => e.context?.listenerId)).toEqual(['actor-b', 'actor-b', 'actor-a'])
    expect(result.stats.entriesWithListener).toBe(3)
    for (const entry of result.entries) {
      expect(entry.context?.listenerProvenance).toEqual({ source: 'structural-inference', confidence: 'medium' })
      expect(entry.context?.listenerGender).toBeUndefined()
      expect(entry.context?.scene).toBe('synthetic/hall')
      expect(entry.context?.conversationId).toBe('inkb:synthetic/hall')
    }
    expect(result.entries.map((e) => e.context?.speaker)).toEqual(['Ada', 'Ada', 'Bo'])
    expect(result.entries.map((e) => e.context?.speakerId)).toEqual(['actor-a', 'actor-a', 'actor-b'])
    expect(result.entries[1].rawMetadata?.continuation).toBe(true)
  })

  it('requires the player to actually speak and works both directions without manufacturing an id', () => {
    const result = extract(['Bo: Test question.', 'Ada: Test answer.'], { Bo: 'actor-b' }, 'Ada')
    expect(result.entries.map((e) => e.context?.listener)).toEqual(['Ada', 'Bo'])
    expect(result.entries[0].context?.listenerId).toBeUndefined()
    expect(result.entries[1].context?.listenerId).toBe('actor-b')
    expect(extract(['Bo: Test monologue.'], characters, 'Ada').stats.entriesWithListener).toBe(0)
  })

  it.each([
    { cast: { ...characters, Cy: 'actor-c' }, lines: ['Ada: Test one.', 'Bo: Test two.', 'Cy: Test three.'] },
    { cast: { ...characters, Cy: 'actor-c' }, lines: ['Ada: Test one.', 'Bo: Test two.'] },
    { cast: characters, lines: ['Ada: Test one.', 'Bo: Test two.', 'Unknown: Test three.'] },
    { cast: { Ada: 'same-id', Bo: 'same-id' }, lines: ['Ada: Test one.', 'Bo: Test two.'] },
  ])('does not infer from ambiguous casts, unknown speakers, or adjacency: $cast', ({ cast, lines }) => {
    const result = extract(lines, cast, 'Ada')
    expect(result.entries.every((e) => !e.context?.listener && !e.context?.listenerProvenance)).toBe(true)
    expect(result.stats.entriesWithListener).toBe(0)
  })

  it('does not assign listeners to narration, thoughts, choices, or interrupted continuations', () => {
    const result = extract([
      'A synthetic narrator sentence.', 'Ada: Test greeting.', ':: A test thought.',
      'A continued thought sentence.', '$ push_timed_choices 2 0', '(Test option)',
      '$ wait 1', 'A bare sentence after the choice.', 'Bo: Test reply.',
    ])
    expect(result.entries.map((e) => e.context?.listener)).toEqual([undefined, 'Bo', undefined, undefined, undefined, undefined, 'Ada'])
    expect(result.stats.entriesWithListener).toBe(2)
    expect(result.entries.find((e) => e.classification === 'Choice')?.context?.listener).toBeUndefined()
  })

  it('resolves focus-command stable ids without changing existing speaker attribution', () => {
    const result = extract(['$ F actor-a default', 'Test focus line.', 'Bo: Test reply.'])
    // The current focus grammar uses alphanumeric/underscore ids.
    const focused = extractInkb('focus.inkb', buildInkb([
      'characters: {"Ada":"actorA","Bo":"actorB"}', '$ F actorA default',
      'Test focus line.', 'Bo: Test reply.',
    ]))
    expect(focused.entries[0].context?.speaker).toBe('actorA')
    expect(focused.entries[0].context?.listener).toBe('Bo')
    expect(focused.entries[1].context?.listenerId).toBe('actorA')
    expect(result.stats.entriesWithListener).toBe(0)
  })

  it.each(['listener', 'receiver', 'target', 'recipient', 'to', 'audience', 'directedAt'])('preserves explicit %s and its high-confidence provenance', (field) => {
    const fromHeader = extractInkb('explicit.inkb', buildInkb([
      `characters: ${JSON.stringify(characters)}`, `${field}: "Explicit recipient"`, '$ pass',
      'Ada: Synthetic greeting.', 'An uninterrupted continuation.', 'Bo: Synthetic reply.', ':: Test thought.',
    ]))
    expect(fromHeader.entries.slice(0, 3).every((e) => e.context?.listener === 'Explicit recipient')).toBe(true)
    expect(fromHeader.entries[3].context?.listener).toBeUndefined()
    expect(fromHeader.stats.entriesWithListener).toBe(3)
    expect(fromHeader.entries[0].context?.listenerProvenance).toEqual({ source: 'explicit-field', confidence: 'high' })
    const result = extract(['Ada: Test greeting.', 'Bo: Test reply.'])
    const explicit = inferContextFromRecord({ speaker: 'Ada', [field]: 'Explicit recipient', listenerGender: 'female' }).context
    result.entries[0].context = explicit
    inferInkbListeners(result.entries, { type: 'dialogue', characters })
    expect(result.entries[0].context).toEqual(explicit)
    expect(explicit.listener).toBe('Explicit recipient')
    expect(explicit.listenerProvenance).toEqual({ source: 'explicit-field', confidence: 'high' })
    expect(explicit.listenerGender).toBe('female')
  })

  it('keeps plural explicit listeners and user-mapped listener provenance', () => {
    const fromHeader = extractInkb('audience.inkb', buildInkb([
      `characters: ${JSON.stringify(characters)}`, 'audience: ["Bo", "Cy"]', '$ pass', 'Ada: Synthetic greeting.',
    ]))
    expect(fromHeader.entries).toHaveLength(1)
    expect(fromHeader.entries[0].context?.listeners).toEqual(['Bo', 'Cy'])
    expect(fromHeader.stats.entriesWithListener).toBe(1)
    const result = extract(['Ada: Test greeting.', 'Bo: Test reply.'])
    result.entries[0].context = { speaker: 'Ada', listeners: ['Bo', 'Cy'], listenerProvenance: { source: 'explicit-field', confidence: 'high' } }
    inferInkbListeners(result.entries, { type: 'dialogue', characters })
    expect(result.entries[0].context.listeners).toEqual(['Bo', 'Cy'])
    expect(result.entries[0].context.listener).toBeUndefined()
    expect(inferContextFromRecord({ customTo: 'Bo' }, [{ fieldName: 'customTo', role: 'listener' }]).context.listenerProvenance)
      .toEqual({ source: 'user-mapped', confidence: 'high' })
  })

  it('does not overwrite an explicit listener id or infer around a wider explicit audience', () => {
    const entries = extract(['Ada: Test greeting.', 'Bo: Test reply.']).entries
    entries[0].context = { speaker: 'Ada', listenerId: 'actor-b' }
    entries[1].context = { speaker: 'Bo' }
    inferInkbListeners(entries, { type: 'dialogue', characters })
    expect(entries[0].context).toEqual({ speaker: 'Ada', listenerId: 'actor-b' })
    entries[0].context = { speaker: 'Ada', listener: 'Cy' }
    entries[1].context = { speaker: 'Bo' }
    inferInkbListeners(entries, { type: 'dialogue', characters })
    expect(entries[0].context.listener).toBe('Cy')
    expect(entries[1].context.listener).toBeUndefined()
  })

  it('does not replace an unreadable explicit target with an inferred one', () => {
    const result = extractInkb('invalid-target.inkb', buildInkb([
      `characters: ${JSON.stringify(characters)}`, 'target: {"unsupported":"shape"}', '$ pass',
      'Ada: Synthetic greeting.', 'Bo: Synthetic reply.',
    ]))
    expect(result.stats.entriesWithListener).toBe(0)
  })

  it.each([null, '', [], {}])('allows safe two-party inference with empty receiver %j', (value) => {
    const result = extractInkb('empty-receiver.inkb', buildInkb([
      `characters: ${JSON.stringify(characters)}`, `receiver: ${JSON.stringify(value)}`, '$ pass',
      'Ada: Synthetic greeting.', 'Bo: Synthetic reply.',
    ]))
    expect(result.entries.map((e) => e.context?.listener)).toEqual(['Bo', 'Ada'])
    expect(result.entries.every((e) => e.context?.listenerProvenance?.source === 'structural-inference')).toBe(true)
  })

  it('normalizes a shallow receiver object and explicit gender before inference', () => {
    const result = extractInkb('receiver-object.inkb', buildInkb([
      `characters: ${JSON.stringify(characters)}`, 'Receiver: {"displayName":"Cy","id":"actor-c","gender":"female"}',
      '$ pass', 'Ada: Synthetic greeting.', 'Bo: Synthetic reply.',
    ]))
    for (const entry of result.entries) expect(entry.context).toMatchObject({
      listener: 'Cy', listenerId: 'actor-c', listenerGender: 'female',
      listenerProvenance: { source: 'explicit-field', confidence: 'high' },
      listenerGenderProvenance: { source: 'explicit-field', confidence: 'high' },
    })
  })

  it.each(['Bo', 'actor-b'])('retains a reliable id for an explicit target %s', (target) => {
    const result = extractInkb('explicit-id.inkb', buildInkb([
      `characters: ${JSON.stringify(characters)}`, `listener: "${target}"`, '$ pass', 'Ada: Synthetic greeting.',
    ]))
    expect(result.entries[0].context?.listener).toBe(target)
    expect(result.entries[0].context?.listenerId).toBe('actor-b')
  })
})
