import { describe, expect, it } from 'vitest'
import { extractGodot } from './godot'
import { extractUnity } from './unity'
import { extractUnrealText, extractUnrealLocres } from './unreal'
import { extractInk } from './ink'
import { readLocres, isLocresBuffer } from './locres'
import { extractUnrealTokens } from '../../tokens/unreal'
import { extractUnityTokens } from '../../tokens/unity'

const ARABIC_CSV = `keys,en,ar,comments
greeting,Hello,مرحبا,"comment"
farewell,Goodbye,وداعا,
`

const ARABIC_DIALOGUE = JSON.stringify([
  { "speaker": "Mira", "listener": "Player", "speakerGender": "female", "text": "Where have you been?" },
  { "speaker": "Mira", "text": "I was worried.", "scene": "chapter3" },
])

const UNITY_STRING_TABLE = JSON.stringify({
  Locale: { en: { Code: "en", Name: "English" }, ar: { Code: "ar", Name: "Arabic" } },
  Table: {
    en: { "menu_start": "Start", "menu_quit": "Quit" },
    ar: { "menu_start": "ابدأ", "menu_quit": "خروج" },
  },
})

const UNREAL_STRING_TABLE = `Key,SourceString,Comment
Menu_Start,Start Game,
Menu_Quit,Quit,
`

const INK_JSON = JSON.stringify({
  inkVersion: 21,
  storyContent: [
    "^Mira: Where have you been?",
    "* Ask about the sword",
    "^I lost it.",
  ],
})

describe('Godot adapter', () => {
  it('extracts Godot CSV localization with key + locales', () => {
    const result = extractGodot({ fileName: 'game.csv', text: ARABIC_CSV })
    expect(result.engine).toBe('godot')
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].key).toBe('greeting')
    expect(result.entries[0].sourceText).toBe('Hello')
    expect(result.entries[0].existingTranslation).toBe('مرحبا')
    expect(result.entries[0].sourceLocale).toBe('en')
  })

  it('extracts Arabic dialogue JSON with speaker/gender context', () => {
    const result = extractGodot({ fileName: 'dialogue.json', text: ARABIC_DIALOGUE })
    expect(result.entries.length).toBeGreaterThanOrEqual(2)
    const first = result.entries.find((e) => e.sourceText === 'Where have you been?')
    expect(first).toBeDefined()
    expect(first?.context?.speaker).toBe('Mira')
    expect(first?.context?.listener).toBe('Player')
    expect(first?.context?.speakerGender).toBe('female')
    expect(first?.classification).toBe('Dialogue')
  })

  it('preserves Arabic characters without corruption', () => {
    const result = extractGodot({ fileName: 'game.csv', text: ARABIC_CSV })
    expect(result.entries[0].existingTranslation).toBe('مرحبا')
  })
})

describe('Unity adapter', () => {
  it('extracts Unity Localization String Table JSON', () => {
    const result = extractUnity({ fileName: 'strings.json', text: UNITY_STRING_TABLE })
    expect(result.engine).toBe('unity')
    expect(result.entries).toHaveLength(2)
    const start = result.entries.find((e) => e.key === 'menu_start')
    expect(start?.sourceText).toBe('Start')
    expect(start?.existingTranslation).toBe('ابدأ')
    expect(start?.classificationConfidence).toBe('high')
  })

  it('extracts structured dialogue from a TextAsset JSON', () => {
    const result = extractUnity({ fileName: 'dialogue.json', text: ARABIC_DIALOGUE })
    const first = result.entries.find((e) => e.sourceText === 'Where have you been?')
    expect(first?.context?.speaker).toBe('Mira')
  })
})

describe('Unreal adapter', () => {
  it('extracts Unreal String Table CSV', () => {
    const result = extractUnrealText({ fileName: 'ST_Game.csv', text: UNREAL_STRING_TABLE })
    expect(result.engine).toBe('unreal')
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].key).toBe('Menu_Start')
    expect(result.entries[0].sourceText).toBe('Start Game')
  })

  it('detects a LOCRES buffer', () => {
    const buffer = new Uint8Array(16)
    buffer[0] = 0x0e; buffer[1] = 0x14; buffer[2] = 0x74; buffer[3] = 0x75
    expect(isLocresBuffer(buffer)).toBe(true)
  })

  it('reports legacy LOCRES version as unsupported', () => {
    const buffer = new Uint8Array(12)
    buffer[0] = 0x0e; buffer[1] = 0x14; buffer[2] = 0x74; buffer[3] = 0x75
    // version = 1 (legacy)
    buffer[4] = 1
    const result = readLocres(buffer, {})
    expect(result.diagnostics.some((d) => d.kind === 'unsupported-engine-version')).toBe(true)
  })

  it('reads an optimized (v2) LOCRES with namespace/key/source', () => {
    const encoder = new TextEncoder()
    const ns = 'Dialogue'
    const key = 'Greeting'
    const src = 'Hello, world.'
    const nsBytes = new Uint8Array(ns.length * 2 + 2)
    const keyBytes = new Uint8Array(key.length * 2 + 2)
    const srcBytes = new Uint8Array(src.length * 2 + 2)
    const write = (target: Uint8Array, str: string) => {
      for (let i = 0; i < str.length; i += 1) {
        const code = str.charCodeAt(i)
        target[i * 2] = code & 0xff
        target[i * 2 + 1] = code >> 8
      }
    }
    write(nsBytes, ns)
    write(keyBytes, key)
    write(srcBytes, src)

    // Layout: magic(4) + version(4) + count(4) + entry[hash(4)+offset(4)] + string table
    const stringTable = new Uint8Array([...nsBytes, ...keyBytes, ...srcBytes])
    const total = 12 + 8 + stringTable.length
    const buffer = new Uint8Array(total)
    const dv = new DataView(buffer.buffer)
    dv.setUint32(0, 0x7574140e, true)
    dv.setInt32(4, 2, true)
    dv.setInt32(8, 1, true)
    dv.setUint32(12, 0x12345678, true) // hash
    dv.setUint32(16, 20, true) // offset to string table (12 + 8 = 20)

    for (let i = 0; i < stringTable.length; i += 1) buffer[20 + i] = stringTable[i]

    const result = extractUnrealLocres({ fileName: 'Game.locres', buffer })
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].key).toBe('Greeting')
    expect(result.entries[0].namespace).toBe('Dialogue')
    expect(result.entries[0].sourceText).toBe('Hello, world.')
  })
})

describe('Ink adapter', () => {
  it('extracts Ink dialogue lines and choices', () => {
    const result = extractInk({ fileName: 'story.ink.json', text: INK_JSON })
    expect(result.engine).toBe('ink')
    const dialogue = result.entries.filter((e) => e.classification === 'Dialogue')
    const choices = result.entries.filter((e) => e.classification === 'Choice')
    expect(dialogue).toHaveLength(2)
    expect(choices).toHaveLength(1)
    expect(dialogue[0].sourceText).toBe('Where have you been?')
    expect(dialogue[0].context?.speaker).toBe('Mira')
    expect(choices[0].sourceText).toBe('Ask about the sword')
  })
})

describe('token profiles', () => {
  it('protects Unreal FText plural modifiers', () => {
    const tokens = extractUnrealTokens('You have {Count}|plural(one=item,other=items).')
    expect(tokens.some((t) => t.raw.includes('plural'))).toBe(true)
  })

  it('protects Unreal empty inline closing tag', () => {
    const tokens = extractUnrealTokens('Press <bold>OK</>')
    expect(tokens.some((t) => t.raw === '</>')).toBe(true)
  })

  it('protects Unity Smart String nested selectors', () => {
    const tokens = extractUnityTokens('{Count:plural:one=item|other=items}')
    expect(tokens.some((t) => t.raw.includes('plural'))).toBe(true)
  })

  it('protects Unity empty placeholder', () => {
    const tokens = extractUnityTokens('Press {}')
    expect(tokens.some((t) => t.raw === '{}')).toBe(true)
  })
})
