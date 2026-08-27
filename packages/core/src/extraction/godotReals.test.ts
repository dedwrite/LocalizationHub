import { describe, expect, it } from 'vitest'
import { extractPo, parsePo } from './engines/gettext'
import { extractGodot, extractGodotScript } from './engines/godot'
import { scanGame, type ScanFile } from './scanGame'
import { detectEngine } from './engineDetection'

describe('Gettext PO parser', () => {
  it('parses msgid/msgstr with escaped multi-line strings', () => {
    const po = `# Translators: welcome screen
#: res://ui/menu.gd:42
msgid "Welcome to the game"
msgstr "مرحبًا بك في اللعبة"

msgid "Line one\\nline two"
msgstr "سطر واحد\\nسطران"
`
    const messages = parsePo(po)
    expect(messages).toHaveLength(2)
    expect(messages[0].msgid).toBe('Welcome to the game')
    expect(messages[0].msgstr[0]).toBe('مرحبًا بك في اللعبة')
    expect(messages[0].references).toEqual(['res://ui/menu.gd:42'])
    expect(messages[1].msgid).toBe('Line one\nline two')
  })

  it('parses msgctxt and msgid_plural with msgstr[n]', () => {
    const po = `msgctxt "menu"
msgid "Save"
msgid_plural "Save %d files"
msgstr[0] "حفظ"
msgstr[1] "حفظ %d ملفات"
`
    const messages = parsePo(po)
    expect(messages).toHaveLength(1)
    expect(messages[0].msgctxt).toBe('menu')
    expect(messages[0].msgidPlural).toBe('Save %d files')
    expect(messages[0].msgstr[0]).toBe('حفظ')
    expect(messages[0].msgstr[1]).toBe('حفظ %d ملفات')
  })

  it('emits entries with context + plural variants', () => {
    const result = extractPo('translations.po', 'msgid "Hello"\nmsgstr "Bonjour"\n')
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].sourceText).toBe('Hello')
    expect(result.entries[0].existingTranslation).toBe('Bonjour')
  })
})

describe('GDScript safe extraction', () => {
  it('extracts tr()/tr_n()/TranslationServer.translate() calls only', () => {
    const gd = `extends Node

func _ready():
    print("res://debug/path.gd")
    var path = "res://scene.tscn"
    var s = "plain string literal"
    var label = tr("Settings")
    var items = tr_n("One item", "%d items", count)
    var title = TranslationServer.translate("Main Menu")
    var debug = "DEBUG: internal token"
`
    const result = extractGodotScript('ui.gd', gd)
    const texts = result.entries.map((e) => e.sourceText)
    expect(texts).toContain('Settings')
    expect(texts).toContain('One item')
    expect(texts).toContain('Main Menu')
    // Plain literals and paths must NOT become entries.
    expect(texts).not.toContain('plain string literal')
    expect(texts).not.toContain('res://scene.tscn')
    expect(texts).not.toContain('res://debug/path.gd')
    expect(texts).not.toContain('DEBUG: internal token')
  })

  it('emits plural variants for tr_n()', () => {
    const result = extractGodotScript('ui.gd', 'var x = tr_n("Apple", "Apples", n)')
    expect(result.entries[0].pluralVariants).toEqual([
      { quantity: 'one', text: 'Apple' },
      { quantity: 'other', text: 'Apples' },
    ])
  })
})

describe('Godot binary resource classification + diagnostics', () => {
  function files(names: string[]): ScanFile[] {
    return names.map((name) => ({ name, relativePath: name, absolutePath: name, size: 0 }))
  }

  it('aggregates .res/.translation/.scn/.gdc into one binary-resource card', async () => {
    const result = await scanGame({
      files: files(['a.res', 'b.res', 'c.translation', 'd.scn', 'e.gdc']),
      reader: { readText: async () => '', readBinary: async () => new Uint8Array() },
    })
    const binary = result.diagnostics.find((d) => d.kind === 'binary-resource-not-converted')
    expect(binary).toBeTruthy()
    expect(binary?.count).toBe(5)
    // .inkb is now a parseable story (not a binary diagnostic).
    expect(result.diagnostics.find((d) => d.kind === 'ink-binary-not-parsed')).toBeUndefined()
    expect(result.diagnostics.length).toBeLessThan(3)
  })

  it('does NOT read binary .scn as UTF-8 text', async () => {
    const result = await scanGame({
      files: files(['level.scn']),
      reader: {
        readText: async () => { throw new Error('should not read .scn as text') },
        readBinary: async () => new Uint8Array([0x52, 0x53, 0x52, 0x43]),
      },
    })
    expect(result.entries).toHaveLength(0)
    expect(result.diagnostics.some((d) => d.kind === 'binary-resource-not-converted')).toBe(true)
  })
})

describe('engine detection confidence', () => {
  it('gives HIGH confidence for many Godot resources without project.godot', () => {
    const names = Array.from({ length: 500 }, (_, i) => `scene_${i}.tscn`)
    const detection = detectEngine({
      files: names.map((name) => ({ name, lower: name.toLowerCase() })),
      directories: [],
    })
    expect(detection.engine).toBe('godot')
    expect(detection.confidence).toBe('high')
  })
})

describe('UI text field extraction (Until Then databases)', () => {
  it('extracts name/description/category from nested JSON records', () => {
    const json = JSON.stringify({
      pages: {
        '5pe3wgdwiyh': {
          category: 'Regional Trial Court',
          description: 'Potatoes.',
          liked: true,
          like_count: 43251,
          name: 'Princess Sharon Memes',
          display_picture: 'assets/media/f7e06ac754c1c876b10fada3b8ca3326.png',
        },
      },
    })
    const result = extractGodot({ fileName: 'fb.json', text: json })
    const texts = result.entries.map((e) => e.sourceText)
    expect(texts).toContain('Princess Sharon Memes')
    expect(texts).toContain('Potatoes.')
    expect(texts).toContain('Regional Trial Court')
    // Paths and numeric fields are excluded.
    expect(texts).not.toContain('assets/media/f7e06ac754c1c876b10fada3b8ca3326.png')
  })
})

describe('zero-entry safety', () => {
  it('emits no-translatable-text when resources exist but nothing extracted', async () => {
    const result = await scanGame({
      files: [{ name: 'a.res', relativePath: 'a.res', absolutePath: 'a.res', size: 0 }],
      reader: { readText: async () => '', readBinary: async () => new Uint8Array([0x52, 0x53, 0x52, 0x43]) },
    })
    expect(result.entries).toHaveLength(0)
    expect(result.diagnostics.some((d) => d.kind === 'no-translatable-text')).toBe(true)
  })
})
