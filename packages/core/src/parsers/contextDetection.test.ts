/*
 * Generic "Open File" context-preservation acceptance tests.
 *
 * Pins the v0.7 requirement that opening an ordinary JSON/CSV/PO file must
 * preserve explicit speaker/listener/gender/context — never flatten a rich
 * dialogue record into only key + text, and never GUESS gender from names.
 */

import { describe, expect, it } from 'vitest'
import { parseLocalizationFile } from './index'
import {
  detectDialogueContext,
  buildCharacterDatabase,
  normalizeContextFieldName,
} from './contextDetection'

function entriesOf(text: string, fileName: string) {
  const result = parseLocalizationFile(text, fileName)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result.document.entries
}

describe('normalizeContextFieldName', () => {
  it('normalizes camelCase and dashes', () => {
    expect(normalizeContextFieldName('speakerName')).toBe('speaker_name')
    expect(normalizeContextFieldName('Speaker-Gender')).toBe('speaker_gender')
    expect(normalizeContextFieldName('speaker_id')).toBe('speaker_id')
  })
})

describe('JSON nested speaker/listener/gender', () => {
  it('preserves nested speaker/listener objects with ids and genders', () => {
    const text = JSON.stringify([
      {
        id: '001',
        speaker: { id: 'mark', name: 'Mark', gender: 'male' },
        listener: { id: 'cathy', name: 'Cathy', gender: 'female' },
        text: 'Where are you going?',
      },
    ])
    const [entry] = entriesOf(text, 'dialogue.json')
    expect(entry.source).toBe('Where are you going?')
    expect(entry.dialogueContext?.speaker).toBe('Mark')
    expect(entry.dialogueContext?.speakerId).toBe('mark')
    expect(entry.dialogueContext?.speakerGender).toBe('male')
    expect(entry.dialogueContext?.listener).toBe('Cathy')
    expect(entry.dialogueContext?.listenerId).toBe('cathy')
    expect(entry.dialogueContext?.listenerGender).toBe('female')
  })
})

describe('JSON flat records', () => {
  it('preserves flat speaker_id/speaker_gender/listener columns', () => {
    const text = JSON.stringify({
      lines: [
        { speaker_id: 'mark', speaker_name: 'Mark', speaker_gender: 'male', listener: 'Cathy', listener_gender: 'female', text: 'Hi' },
      ],
    })
    const [entry] = entriesOf(text, 'dialogue.json')
    expect(entry.source).toBe('Hi')
    expect(entry.dialogueContext?.speaker).toBe('Mark')
    expect(entry.dialogueContext?.speakerId).toBe('mark')
    expect(entry.dialogueContext?.speakerGender).toBe('male')
    expect(entry.dialogueContext?.listener).toBe('Cathy')
    expect(entry.dialogueContext?.listenerGender).toBe('female')
  })
})

describe('JSON character database + dialogue references', () => {
  it('resolves speaker id to name + gender from the characters table', () => {
    const text = JSON.stringify({
      characters: {
        mark: { name: 'Mark', gender: 'male' },
        cathy: { name: 'Cathy', gender: 'female' },
      },
      dialogue: [
        { speaker: 'mark', listener: 'cathy', text: 'Are you sure?' },
      ],
    })
    const [entry] = entriesOf(text, 'dialogue.json')
    expect(entry.source).toBe('Are you sure?')
    expect(entry.dialogueContext?.speaker).toBe('Mark')
    expect(entry.dialogueContext?.speakerId).toBe('mark')
    expect(entry.dialogueContext?.speakerGender).toBe('male')
    expect(entry.dialogueContext?.listener).toBe('Cathy')
    expect(entry.dialogueContext?.listenerGender).toBe('female')
  })
})

describe('CSV context import', () => {
  it('preserves speaker/listener/gender columns', () => {
    const text = 'id,speaker,speaker_gender,listener,listener_gender,text\n001,Mark,male,Cathy,female,"Where are you going?"'
    const [entry] = entriesOf(text, 'dialogue.csv')
    expect(entry.source).toBe('Where are you going?')
    expect(entry.dialogueContext?.speaker).toBe('Mark')
    expect(entry.dialogueContext?.speakerGender).toBe('male')
    expect(entry.dialogueContext?.listener).toBe('Cathy')
    expect(entry.dialogueContext?.listenerGender).toBe('female')
  })

  it('strips a UTF-8 BOM from the header', () => {
    const text = '\uFEFFid,speaker,text\n001,Mark,Hello'
    const [entry] = entriesOf(text, 'dialogue.csv')
    expect(entry.key).toBe('001')
    expect(entry.source).toBe('Hello')
    expect(entry.dialogueContext?.speaker).toBe('Mark')
  })
})

describe('PO context', () => {
  it('parses explicit Speaker/Listener/Gender comment labels', () => {
    const text = '# Speaker: Mark\n#. Speaker Gender: male\n#: Listener: Cathy\n#. Listener Gender: female\n#. Scene: School Hallway\nmsgid "Where are you going?"\nmsgstr ""\n'
    const [entry] = entriesOf(text, 'dialogue.po')
    expect(entry.source).toBe('Where are you going?')
    expect(entry.dialogueContext?.speaker).toBe('Mark')
    expect(entry.dialogueContext?.speakerGender).toBe('male')
    expect(entry.dialogueContext?.listener).toBe('Cathy')
    expect(entry.dialogueContext?.listenerGender).toBe('female')
    expect(entry.dialogueContext?.scene).toBe('School Hallway')
  })
})

describe('no guessing', () => {
  it('does not infer gender when absent', () => {
    const text = JSON.stringify([{ id: '1', speaker: 'Mark', text: 'Hello' }])
    const [entry] = entriesOf(text, 'dialogue.json')
    expect(entry.dialogueContext?.speaker).toBe('Mark')
    expect(entry.dialogueContext?.speakerGender).toBeUndefined()
    expect(entry.dialogueContext?.listenerGender).toBeUndefined()
  })

  it('does not map a bare gender without a speaker field', () => {
    const ctx = detectDialogueContext({ id: '1', gender: 'female', text: 'x' })
    expect(ctx?.speakerGender).toBeUndefined()
    // raw value is preserved losslessly.
    expect(ctx?.raw?.gender).toBe('female')
  })

  it('normalizes explicit gender values to the shared vocabulary', () => {
    const ctx = detectDialogueContext({ speaker: 'Mark', speaker_gender: 'F', text: 'x' })
    expect(ctx?.speakerGender).toBe('female')
  })

  it('preserves unknown/custom gender values', () => {
    const ctx = detectDialogueContext({ speaker: 'X', speaker_gender: 'attack-helicopter', text: 'x' })
    expect(ctx?.speakerGender).toBe('custom')
    expect(ctx?.raw?.speaker_gender).toBe('attack-helicopter')
  })
})

describe('buildCharacterDatabase', () => {
  it('indexes characters by object key, id, and name', () => {
    const db = buildCharacterDatabase({
      characters: {
        mark: { name: 'Mark', gender: 'male' },
      },
    })
    expect(db.get('mark')?.name).toBe('Mark')
    expect(db.get('Mark')?.gender).toBe('male')
  })

  it('indexes array-form characters by id and name', () => {
    const db = buildCharacterDatabase({
      characters: [{ id: 'cathy', name: 'Cathy', gender: 'female' }],
    })
    expect(db.get('cathy')?.gender).toBe('female')
    expect(db.get('Cathy')?.gender).toBe('female')
  })
})
