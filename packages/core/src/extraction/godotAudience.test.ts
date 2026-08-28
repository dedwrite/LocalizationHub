/*
 * Godot runtime-vs-editor audience classifier tests.
 *
 * Pins the precision behaviour required by the human acceptance:
 *   - editor plugin scenes (`@tool` / EditorPlugin) are excluded by default
 *   - runtime addons (no editor signals) are kept
 *   - short runtime strings are NOT excluded merely for being short
 *   - test/demo content is excluded
 */

import { describe, expect, it } from 'vitest'
import {
  classifyScriptAudience,
  sceneScriptReferences,
  GodotAudienceIndex,
  normalizeGodotPath,
} from './godotAudience'

describe('classifyScriptAudience', () => {
  it('flags @tool scripts as editor tooling', () => {
    expect(classifyScriptAudience('@tool\nextends Control')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('flags EditorPlugin-derived scripts as editor', () => {
    expect(classifyScriptAudience('extends EditorPlugin')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('flags EditorInspectorPlugin-derived scripts as editor', () => {
    expect(classifyScriptAudience('extends EditorInspectorPlugin')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('flags EditorInterface usage as editor', () => {
    expect(classifyScriptAudience('var e = get_editor_interface()')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('does NOT flag a runtime script without editor signals', () => {
    expect(classifyScriptAudience('extends Node\nfunc _ready(): pass')).toBeNull()
  })
})

describe('sceneScriptReferences', () => {
  it('extracts referenced script paths', () => {
    const content = '[gd_scene load_steps=2]\n\n[ext_resource type="Script" path="res://addons/animpaper3dgen/Panel.gd" id="1"]\n\n[node name="Panel" type="Control"]'
    expect(sceneScriptReferences(content)).toEqual(['res://addons/animpaper3dgen/Panel.gd'])
  })
})

describe('GodotAudienceIndex', () => {
  it('classifies a scene referencing an editor script as editor', () => {
    const index = new GodotAudienceIndex()
    index.registerScript('UntilThen.pck::addons/animpaper3dgen/Panel.gd', classifyScriptAudience('@tool\nextends Control'))
    const result = index.classifyScene(
      'UntilThen.pck::addons/animpaper3dgen/Panel.tscn',
      '[ext_resource type="Script" path="res://addons/animpaper3dgen/Panel.gd" id="1"]',
    )
    expect(result).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('keeps a runtime addon scene without editor references as runtime', () => {
    const index = new GodotAudienceIndex()
    index.registerScript('addons/controller_icons/icon.gd', classifyScriptAudience('extends Node2D\nfunc _ready(): pass'))
    const result = index.classifyScene(
      'addons/controller_icons/IconDisplay.tscn',
      '[ext_resource type="Script" path="res://addons/controller_icons/icon.gd" id="1"]',
    )
    expect(result.audience).toBe('runtime')
  })

  it('flags test/demo paths as test content', () => {
    const index = new GodotAudienceIndex()
    expect(index.classifyScene('addons/x/tests/debug_action.tscn', '[gd_scene]').audience).toBe('test')
  })

  it('flags editor-ish paths as editor even without script refs', () => {
    const index = new GodotAudienceIndex()
    expect(index.classifyScene('addons/proton_scatter/src/stack/inspector_plugin/ui/stack_panel.tscn', '[gd_scene]')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })
})

describe('normalizeGodotPath', () => {
  it('strips container prefix and res://', () => {
    expect(normalizeGodotPath('UntilThen.pck::addons/x/Panel.gd')).toBe('addons/x/Panel.gd')
    expect(normalizeGodotPath('res://addons/x/Panel.gd')).toBe('addons/x/Panel.gd')
    expect(normalizeGodotPath('addons/x/Panel.gd')).toBe('addons/x/Panel.gd')
  })
})
