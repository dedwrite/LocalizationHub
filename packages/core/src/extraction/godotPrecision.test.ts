/*
 * Godot precision integration tests (scanGame-level).
 *
 * - BOM-prefixed JSON databases parse (the desktop 7-error bug)
 * - editor plugin scenes are excluded by default (excludedByDefault + reason)
 * - runtime addon text is NOT excluded, including short strings ("X", "OK")
 * - test/demo resources are excluded
 */

import { describe, expect, it } from 'vitest'
import { scanGame, type ScanFile } from './scanGame'
import { extractGodot } from './engines/godot'

function file(name: string, abs: string, size = 0): ScanFile {
  return { name, relativePath: name, absolutePath: abs, size }
}

describe('BOM-prefixed JSON databases', () => {
  it('parses a BOM-prefixed JSON database (the 7-error root cause)', () => {
    const body = JSON.stringify({ pages: { x: { name: 'Filipino title' } } })
    const withBom = `\uFEFF${body}`
    const result = extractGodot({ fileName: 'email_fil.json', text: withBom })
    expect(result.diagnostics).toHaveLength(0)
    expect(result.entries.length).toBeGreaterThan(0)
    expect(result.entries[0].sourceText).toBe('Filipino title')
  })
})

describe('Godot runtime-vs-editor precision (scanGame)', () => {
  const editorPluginGd = '@tool\nextends EditorPlugin\nfunc _enter_tree(): pass'
  const editorPanelGd = '@tool\nextends Control\nvar e = get_editor_interface()'
  const editorPanelTscn = '[gd_scene load_steps=2]\n\n[ext_resource type="Script" path="res://addons/animpaper3dgen/Panel.gd" id="1"]\n\n[node name="Panel" type="Control"]\ntext = "Generate"'

  it('excludes editor plugin scenes by default with a reason', async () => {
    const files: ScanFile[] = [
      file('addons/animpaper3dgen/Panel.gd', '/a/Panel.gd'),
      file('addons/animpaper3dgen/Panel.tscn', '/a/Panel.tscn'),
    ]
    const reader = {
      readText: async (f: ScanFile) => (f.name.endsWith('.gd') ? editorPanelGd : editorPanelTscn),
      readBinary: async () => new Uint8Array(0),
    }
    const result = await scanGame({ files, reader })
    const uiEntries = result.entries.filter((e) => e.classification === 'UI' || e.classification === 'Menu')
    expect(uiEntries.length).toBeGreaterThan(0)
    expect(uiEntries.every((e) => e.excludedByDefault === true)).toBe(true)
    expect(uiEntries.every((e) => e.exclusionReason === 'godot-editor-plugin')).toBe(true)
    expect(result.stats.developerExcluded).toBeGreaterThan(0)
  })

  it('keeps runtime addon text (including short strings)', async () => {
    const runtimeGd = 'extends Node\nfunc _ready(): pass'
    const runtimeTscn = '[gd_scene load_steps=2]\n\n[ext_resource type="Script" path="res://addons/runtime_ui/retry.gd" id="1"]\n\n[node name="Retry" type="Button"]\ntext = "Retry"\n\n[node name="OK" type="Button"]\ntext = "OK"\n\n[node name="X" type="Button"]\ntext = "X"'
    const files: ScanFile[] = [
      file('addons/runtime_ui/retry.gd', '/b/retry.gd'),
      file('addons/runtime_ui/retry.tscn', '/b/retry.tscn'),
    ]
    const reader = {
      readText: async (f: ScanFile) => (f.name.endsWith('.gd') ? runtimeGd : runtimeTscn),
      readBinary: async () => new Uint8Array(0),
    }
    const result = await scanGame({ files, reader })
    const texts = result.entries.map((e) => e.sourceText)
    expect(texts).toContain('Retry')
    expect(texts).toContain('OK')
    expect(texts).toContain('X')
    // None of them should be auto-excluded.
    expect(result.entries.every((e) => !e.excludedByDefault)).toBe(true)
  })

  it('excludes test/demo resources by default', async () => {
    const testTscn = '[gd_scene]\n\n[node name="Button" type="Button"]\ntext = "Debug Action"'
    const files: ScanFile[] = [file('addons/x/tests/debug.tscn', '/c/debug.tscn')]
    const reader = {
      readText: async () => testTscn,
      readBinary: async () => new Uint8Array(0),
    }
    const result = await scanGame({ files, reader })
    const entry = result.entries.find((e) => e.sourceText === 'Debug Action')
    expect(entry).toBeTruthy()
    expect(entry?.excludedByDefault).toBe(true)
    expect(entry?.exclusionReason).toBe('test-resource')
  })
})
