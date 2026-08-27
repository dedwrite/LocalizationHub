import { describe, expect, it } from 'vitest'
import { extractGodot } from './godot'
import { extractUnity } from './unity'
import { extractUnrealText, extractUnrealLocres, extractUnrealLocmeta } from './unreal'
import { extractInk } from './ink'
import { readLocres, isLocresBuffer, LOCRES_MAGIC, ELocResVersion } from './locres'
import { readLocmeta, LOCMETA_MAGIC } from './locmeta'
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

  it('detects a LOCRES buffer by its full FGuid magic', () => {
    const buffer = buildLocres({ namespaces: [] })
    expect(isLocresBuffer(buffer)).toBe(true)
  })

  it('reads a Compact-format LOCRES with namespace/key/source-hash/localized-value', () => {
    const buffer = buildLocres({
      namespaces: [
        {
          namespace: 'Dialogue',
          keys: [
            { key: 'Greeting', sourceHash: 0x12345678, localized: 'Hello, world.' },
            { key: 'Farewell', sourceHash: 0x9abcdef0, localized: 'Goodbye.' },
          ],
        },
        {
          namespace: 'UI',
          keys: [
            { key: 'Menu_Start', sourceHash: 0x11111111, localized: 'Start' },
          ],
        },
      ],
    })

    const result = readLocres(buffer, { containerPath: 'Game/Localization/Dialogue/en/Dialogue.locres' })

    expect(result.version).toBe(ELocResVersion.Compact)
    expect(result.versionLabel).toBe('Compact')
    expect(result.entries).toHaveLength(3)

    const greeting = result.entries.find((e) => e.key === 'Greeting')
    expect(greeting?.namespace).toBe('Dialogue')
    expect(greeting?.sourceText).toBe('Hello, world.')
    expect(greeting?.rawMetadata?.sourceStringHash).toBe(0x12345678)
    expect(greeting?.sourceLocale).toBe('en')

    const menuStart = result.entries.find((e) => e.key === 'Menu_Start')
    expect(menuStart?.namespace).toBe('UI')
  })

  it('reads a Legacy-format LOCRES (no magic) with inline FString values', () => {
    const buffer = buildLegacyLocres([
      { namespace: 'LegacyNs', key: 'K1', sourceHash: 1, localized: 'Value One' },
      { namespace: 'LegacyNs', key: 'K2', sourceHash: 2, localized: 'Value Two' },
    ])

    const result = readLocres(buffer, {})
    expect(result.version).toBe(ELocResVersion.Legacy)
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].key).toBe('K1')
    expect(result.entries[0].sourceText).toBe('Value One')
  })

  it('preserves UTF-16 (Arabic) localized values in a Compact LOCRES', () => {
    const buffer = buildLocres({
      namespaces: [
        { namespace: 'Dialogue', keys: [{ key: 'Greeting', sourceHash: 7, localized: 'مرحبا بالعالم' }] },
      ],
    })

    const result = readLocres(buffer, {})
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].sourceText).toBe('مرحبا بالعالم')
  })

  it('reports a too-new LOCRES version as unsupported', () => {
    const writer = new ByteWriter()
    writer.writeGuid(LOCRES_MAGIC)
    writer.writeU8(99) // future version
    const result = readLocres(writer.bytes(), {})
    expect(result.diagnostics.some((d) => d.kind === 'unsupported-engine-version')).toBe(true)
  })

  it('LOCMETA is parsed as metadata, never as a translatable resource', () => {
    const writer = new ByteWriter()
    writer.writeGuid(LOCMETA_MAGIC)
    writer.writeU8(1) // AddedCompiledCultures
    writer.writeFString('en')
    writer.writeFString('Engine')
    writer.writeU32(2)
    writer.writeFString('fr')
    writer.writeFString('de')

    const meta = readLocmeta(writer.bytes())
    expect(meta.nativeCulture).toBe('en')
    expect(meta.nativeLocRes).toBe('Engine')
    expect(meta.compiledCultures).toEqual(['fr', 'de'])

    const result = extractUnrealLocmeta({ fileName: 'Engine.locmeta', buffer: writer.bytes() })
    expect(result.entries).toHaveLength(0)
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

/*
 * Synthetic fixture builders that encode the REAL LOCRES binary format
 * (verified against CUE4Parse), so the parser is tested against correct data
 * rather than the previous incorrect assumptions.
 */

class ByteWriter {
  private chunks: Uint8Array[] = []

  writeU8(value: number) { this.chunks.push(new Uint8Array([value & 0xff])) }

  writeU32(value: number) {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setUint32(0, value >>> 0, true)
    this.chunks.push(b)
  }

  writeI32(value: number) {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setInt32(0, value, true)
    this.chunks.push(b)
  }

  writeI64(value: number) {
    const b = new Uint8Array(8)
    new DataView(b.buffer).setBigInt64(0, BigInt(value), true)
    this.chunks.push(b)
  }

  writeGuid(parts: readonly number[]) {
    for (const p of parts) this.writeU32(p)
  }

  writeFString(value: string) {
    const isAscii = /^[\x00-\x7F]*$/u.test(value)
    if (isAscii) {
      this.writeI32(value.length + 1)
      const b = new Uint8Array(value.length + 1)
      for (let i = 0; i < value.length; i += 1) b[i] = value.charCodeAt(i)
      this.chunks.push(b)
    } else {
      this.writeI32(-(value.length + 1))
      const b = new Uint8Array((value.length + 1) * 2)
      for (let i = 0; i < value.length; i += 1) {
        const code = value.charCodeAt(i)
        b[i * 2] = code & 0xff
        b[i * 2 + 1] = code >> 8
      }
      this.chunks.push(b)
    }
  }

  bytes(): Uint8Array {
    const total = this.chunks.reduce((sum, c) => sum + c.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const c of this.chunks) { out.set(c, offset); offset += c.length }
    return out
  }
}

type LocresNamespace = {
  namespace: string
  keys: Array<{ key: string; sourceHash: number; localized: string }>
}

function buildLocres(input: { namespaces: LocresNamespace[] }): Uint8Array {
  const writer = new ByteWriter()
  writer.writeGuid(LOCRES_MAGIC)
  writer.writeU8(ELocResVersion.Compact)
  writer.writeI64(0) // placeholder offset, patched below

  // Gather the unique localized strings and assign indexes as we write entries.
  const localizedStrings: string[] = []
  const indexes: number[] = []

  writer.writeU32(input.namespaces.length)
  for (const ns of input.namespaces) {
    writer.writeFString(ns.namespace)
    writer.writeU32(ns.keys.length)
    for (const key of ns.keys) {
      writer.writeFString(key.key)
      writer.writeU32(key.sourceHash)
      let index = localizedStrings.indexOf(key.localized)
      if (index === -1) {
        index = localizedStrings.length
        localizedStrings.push(key.localized)
      }
      indexes.push(index)
      writer.writeI32(index)
    }
  }

  const lutOffset = writer.bytes().length

  const lut = new ByteWriter()
  lut.writeI32(localizedStrings.length)
  for (const str of localizedStrings) {
    lut.writeFString(str)
    // Compact LOCRES LUT has no RefCount field (only Optimized variants do).
  }

  const headerBytes = writer.bytes()
  const patched = new Uint8Array(headerBytes.length)
  patched.set(headerBytes)
  new DataView(patched.buffer).setBigInt64(17, BigInt(lutOffset), true)

  const lutBytes = lut.bytes()
  const out = new Uint8Array(patched.length + lutBytes.length)
  out.set(patched)
  out.set(lutBytes, patched.length)
  return out
}

function buildLegacyLocres(
  entries: Array<{ namespace: string; key: string; sourceHash: number; localized: string }>,
): Uint8Array {
  // Legacy format has NO magic and NO version byte: it starts directly with
  // the namespace count.
  const groups = new Map<string, typeof entries>()
  for (const e of entries) {
    const list = groups.get(e.namespace) ?? []
    list.push(e)
    groups.set(e.namespace, list)
  }

  const writer = new ByteWriter()
  writer.writeU32(groups.size)
  for (const [namespace, list] of groups) {
    writer.writeFString(namespace)
    writer.writeU32(list.length)
    for (const e of list) {
      writer.writeFString(e.key)
      writer.writeU32(e.sourceHash)
      writer.writeFString(e.localized)
    }
  }
  return writer.bytes()
}
