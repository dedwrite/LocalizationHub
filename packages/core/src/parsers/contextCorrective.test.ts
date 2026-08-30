/*
 * Generic context corrective-pass tests.
 *
 * Pins the precision-safety behaviours required by the corrective pass:
 *   - custom-field Context Mapping (char_from/char_to/body → speaker/listener/text)
 *   - ambiguous aliases (location/chapter/level/act/sprite/avatar) are
 *     MEDIUM confidence (suggested, NOT auto-applied)
 *   - stable ID vs display-name semantics (name is never promoted to an ID)
 *   - speaker/listener pronouns + multiple listeners
 *   - line_id vs conversation_id are NOT collapsed
 *   - unknown custom gender preserved losslessly
 *   - confidence tiers from detectContextFields
 */

import { describe, expect, it } from 'vitest'
import {
  detectDialogueContext,
  detectContextFields,
  inspectUnmappedFields,
  buildCharacterDatabase,
  normalizeContextFieldName,
  type GenericContextMapping,
} from './contextDetection'
import { parseLocalizationFile } from './index'

describe('custom-field Context Mapping', () => {
  it('maps char_from/char_to/body to speaker/listener/sourceText via mappings', () => {
    const mappings: GenericContextMapping[] = [
      { field: 'char_from', role: 'speaker' },
      { field: 'char_to', role: 'listener' },
      { field: 'body', role: 'sourceText' },
    ]
    const text = 'char_from,char_to,body\nMark,Cathy,Hello there'
    const result = parseLocalizationFile(text, 'dialogue.csv', mappings)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [entry] = result.document.entries
    expect(entry.source).toBe('Hello there')
    expect(entry.dialogueContext?.speaker).toBe('Mark')
    expect(entry.dialogueContext?.listener).toBe('Cathy')
  })

  it('maps sex_a/sex_b to speakerGender/listenerGender', () => {
    const ctx = detectDialogueContext(
      { char_from: 'Mark', sex_a: 'male', char_to: 'Cathy', sex_b: 'female', body: 'x' },
      undefined,
      [
        { field: 'char_from', role: 'speaker' },
        { field: 'char_to', role: 'listener' },
        { field: 'sex_a', role: 'speakerGender' },
        { field: 'sex_b', role: 'listenerGender' },
      ],
    )
    expect(ctx?.speakerGender).toBe('male')
    expect(ctx?.listenerGender).toBe('female')
  })
})

describe('aggressive aliases are MEDIUM (not auto-applied)', () => {
  it('auto-maps the approved who alias but keeps location/chapter/level/act/sprite/avatar for review', () => {
    const ctx = detectDialogueContext({
      who: 'Mark',
      location: 'Hall',
      chapter: 'Ch2',
      level: 'L3',
      act: 'Act1',
      sprite: 'mark.png',
      avatar: 'mark.png',
      text: 'hi',
    })
    expect(ctx?.speaker).toBe('Mark')
    expect(ctx?.scene).toBeUndefined()
    expect(ctx?.portrait).toBeUndefined()
    // But the values are preserved as raw for mapping review.
    expect(ctx?.raw?.who).toBe('Mark')
    expect(ctx?.raw?.location).toBe('Hall')
  })

  it('detectContextFields reports them as MEDIUM confidence suggestions', () => {
    const fields = detectContextFields([{ who: 'Mark', location: 'Hall', text: 'x' }])
    const who = fields.find((f) => f.field === 'who')
    const location = fields.find((f) => f.field === 'location')
    expect(who?.role).toBe('speaker')
    expect(who?.confidence).toBe('high')
    expect(location?.role).toBe('scene')
    expect(location?.confidence).toBe('medium')
  })

  it('reports canonical speaker as HIGH confidence', () => {
    const fields = detectContextFields([{ speaker: 'Mark', text: 'x' }])
    const speaker = fields.find((f) => f.field === 'speaker')
    expect(speaker?.role).toBe('speaker')
    expect(speaker?.confidence).toBe('high')
  })
})

describe('stable ID vs display-name semantics', () => {
  it('does NOT promote a bare speaker name to speakerId', () => {
    const ctx = detectDialogueContext({ speaker: 'Mark', text: 'x' })
    expect(ctx?.speaker).toBe('Mark')
    expect(ctx?.speakerId).toBeUndefined()
  })

  it('sets speakerId from an explicit speaker_id field', () => {
    const ctx = detectDialogueContext({ speaker_id: 'mark_borja', speaker: 'Mark', text: 'x' })
    expect(ctx?.speakerId).toBe('mark_borja')
  })

  it('sets speakerId from a character-record id (object key), not the name', () => {
    const db = buildCharacterDatabase({ characters: { mark: { name: 'Mark', gender: 'male' } } })
    const ctx = detectDialogueContext({ speaker: 'mark', text: 'x' }, db)
    expect(ctx?.speaker).toBe('Mark')
    expect(ctx?.speakerId).toBe('mark')
    expect(ctx?.speakerGender).toBe('male')
  })

  it('resolves a name against the characters table to its id without fabricating', () => {
    const db = buildCharacterDatabase({ characters: { mark_borja: { id: 'mark_borja', name: 'Mark' } } })
    const ctx = detectDialogueContext({ speaker: 'Mark', text: 'x' }, db)
    expect(ctx?.speaker).toBe('Mark')
    expect(ctx?.speakerId).toBe('mark_borja')
  })
})

describe('pronouns and multiple listeners', () => {
  it('preserves explicit speaker/listener pronouns', () => {
    const ctx = detectDialogueContext({
      speaker: 'Mark', speaker_pronouns: 'he/him',
      listener: 'Cathy', listener_pronouns: 'she/her',
      text: 'x',
    })
    expect(ctx?.speakerPronouns).toBe('he/him')
    expect(ctx?.listenerPronouns).toBe('she/her')
  })

  it('preserves multiple listeners and listener ids', () => {
    const ctx = detectDialogueContext({
      speaker: 'Mark',
      listeners: ['Cathy', 'Ryan'],
      listener_ids: ['cathy', 'ryan'],
      text: 'x',
    })
    expect(ctx?.listeners).toEqual(['Cathy', 'Ryan'])
    expect(ctx?.listenerIds).toEqual(['cathy', 'ryan'])
  })

  it('splits comma-separated listener strings', () => {
    const ctx = detectDialogueContext({ speaker: 'Mark', listeners: 'Cathy, Ryan, Louise', text: 'x' })
    expect(ctx?.listeners).toEqual(['Cathy', 'Ryan', 'Louise'])
  })

  it('does NOT infer pronouns when absent', () => {
    const ctx = detectDialogueContext({ speaker: 'Mark', text: 'x' })
    expect(ctx?.speakerPronouns).toBeUndefined()
  })
})

describe('line_id vs conversation_id semantics', () => {
  it('keeps line_id/dialogue_id separate from conversationId', () => {
    const ctx = detectDialogueContext({
      conversation_id: 'conv-1',
      line_id: 'line-42',
      dialogue_id: 'dlg-7',
      text: 'x',
    })
    expect(ctx?.conversationId).toBe('conv-1')
    expect(ctx?.dialogueId).toBe('dlg-7')
    // line_id maps to dialogueId (a LINE identity), never conversationId.
    expect(ctx?.conversationId).not.toBe('line-42')
  })
})

describe('unknown custom gender', () => {
  it('normalizes to custom and preserves the raw value', () => {
    const ctx = detectDialogueContext({ speaker: 'X', speaker_gender: 'attack-helicopter', text: 'x' })
    expect(ctx?.speakerGender).toBe('custom')
    expect(ctx?.raw?.speaker_gender).toBe('attack-helicopter')
  })
})

describe('inspectUnmappedFields', () => {
  it('surfaces custom fields for mapping (char_from/body) but not recognized ones', () => {
    const fields = inspectUnmappedFields([
      { char_from: 'Mark', char_to: 'Cathy', body: 'hi', speaker: 'Mark' },
    ])
    const names = fields.map((f) => f.field)
    expect(names).toContain('char_from')
    expect(names).toContain('char_to')
    expect(names).toContain('body')
    expect(names).not.toContain('speaker') // recognized HIGH field
  })

  it('includes occurrence count and sample values', () => {
    const fields = inspectUnmappedFields([
      { body: 'a' },
      { body: 'b' },
    ])
    const body = fields.find((f) => f.field === 'body')
    expect(body?.occurrenceCount).toBe(2)
    expect(body?.sampleValues).toEqual(['a', 'b'])
  })
})

describe('normalizeContextFieldName', () => {
  it('normalizes camelCase/dashes/spaces', () => {
    expect(normalizeContextFieldName('Speaker Gender')).toBe('speaker_gender')
    expect(normalizeContextFieldName('charFrom')).toBe('char_from')
  })
})
