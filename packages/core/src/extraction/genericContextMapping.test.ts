/*
 * Generic context mapping at the scanGame level.
 *
 * Pins the EXACT end-to-end contract for custom game schemas: fields like
 * `char_from`/`char_to`/`sex_a`/`sex_b`/`body` are not auto-recognized, but a
 * user-supplied ContextFieldMapping drives them through the SAME scanGame
 * pipeline the desktop "Apply & Rerun" mapping flow uses. This is the logic
 * behind the (desktop-only) Context Mapping review UI.
 */

import { describe, expect, it } from 'vitest'
import { scanGame, type ScanFile } from './scanGame'
import type { ContextFieldMapping } from './contextInference'

const MAPPINGS: ContextFieldMapping[] = [
  { fieldName: 'char_from', role: 'speaker' },
  { fieldName: 'char_to', role: 'listener' },
  { fieldName: 'sex_a', role: 'speakerGender' },
  { fieldName: 'sex_b', role: 'listenerGender' },
  { fieldName: 'body', role: 'translatableText' },
]

function jsonFile(name: string, text: string): ScanFile {
  return { name, relativePath: `data/${name}`, absolutePath: `/tmp/${name}`, size: text.length }
}

describe('generic context mapping (scanGame pipeline)', () => {
  it('maps char_from/char_to/sex_a/sex_b/body to speaker/listener/gender/text', async () => {
    const text = JSON.stringify([
      { char_from: 'Mark', char_to: 'Cathy', sex_a: 'm', sex_b: 'f', body: 'Hello there' },
      { char_from: 'Cathy', char_to: 'Mark', sex_a: 'f', sex_b: 'm', body: 'Hey Mark!' },
    ])
    const file = jsonFile('dialogue.json', text)
    const reader = {
      readText: async () => text,
      readBinary: async () => new Uint8Array(0),
    }
    const result = await scanGame({ files: [file], reader, mappings: MAPPINGS })

    expect(result.entries).toHaveLength(2)
    const first = result.entries[0]
    expect(first.sourceText).toBe('Hello there')
    expect(first.context?.speaker).toBe('Mark')
    expect(first.context?.listener).toBe('Cathy')
    expect(first.context?.speakerGender).toBe('male')
    expect(first.context?.listenerGender).toBe('female')
    expect(first.classification).toBe('Dialogue')

    const second = result.entries[1]
    expect(second.sourceText).toBe('Hey Mark!')
    expect(second.context?.speaker).toBe('Cathy')
    expect(second.context?.speakerGender).toBe('female')
    expect(second.context?.listenerGender).toBe('male')
  })

  it('without mappings, char_from/char_to/body are NOT auto-applied as context', async () => {
    const text = JSON.stringify([{ char_from: 'Mark', char_to: 'Cathy', body: 'Hello there' }])
    const file = jsonFile('dialogue.json', text)
    const reader = {
      readText: async () => text,
      readBinary: async () => new Uint8Array(0),
    }
    const result = await scanGame({ files: [file], reader })

    // `body` is not a recognized text alias and `char_from`/`char_to` are not
    // speaker/listener aliases, so no entry should fabricate context.
    const entriesWithText = result.entries.filter((e) => e.sourceText === 'Hello there')
    expect(entriesWithText.every((e) => e.context?.speaker === undefined)).toBe(true)
    expect(entriesWithText.every((e) => e.context?.listener === undefined)).toBe(true)
  })
})
