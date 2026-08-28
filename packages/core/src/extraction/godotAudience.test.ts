/*
 * Godot runtime-vs-editor audience classifier tests.
 *
 * Pins the precision-safety behaviour: auto-exclusion requires HIGH-CONFIDENCE
 * evidence. `@tool` alone and generic path segments (panel/dock/inspector/
 * pages) are only WEAK evidence and never auto-exclude player text.
 */

import { describe, expect, it } from 'vitest'
import {
  classifyScriptAudience,
  sceneScriptReferences,
  scriptScenePreloads,
  GodotAudienceIndex,
  normalizeGodotPath,
} from './godotAudience'

describe('classifyScriptAudience', () => {
  it('flags @tool ALONE as uncertain (NOT editor, NOT auto-excluded)', () => {
    expect(classifyScriptAudience('@tool\nextends Control')).toEqual({ audience: 'unknown', reason: 'godot-tool-script' })
  })

  it('flags EditorPlugin-derived scripts as editor', () => {
    expect(classifyScriptAudience('extends EditorPlugin')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('flags EditorInspectorPlugin-derived scripts as editor', () => {
    expect(classifyScriptAudience('extends EditorInspectorPlugin')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('flags EditorNode3DGizmoPlugin-derived scripts as editor', () => {
    expect(classifyScriptAudience('@tool\nextends EditorNode3DGizmoPlugin')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('flags EditorInterface usage as editor even with @tool', () => {
    expect(classifyScriptAudience('@tool\nextends Control\nvar e = get_editor_interface()')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('classifies a runtime script without editor signals as runtime', () => {
    expect(classifyScriptAudience('extends Node\nfunc _ready(): pass')).toEqual({ audience: 'runtime' })
  })

  it('classifies @tool extends Node3D (runtime node w/ editor preview) as uncertain', () => {
    expect(classifyScriptAudience('@tool\nextends Node3D')).toEqual({ audience: 'unknown', reason: 'godot-tool-script' })
  })
})

describe('sceneScriptReferences', () => {
  it('extracts referenced script paths', () => {
    const content = '[gd_scene load_steps=2]\n\n[ext_resource type="Script" path="res://addons/animpaper3dgen/Panel.gd" id="1"]\n\n[node name="Panel" type="Control"]'
    expect(sceneScriptReferences(content)).toEqual(['res://addons/animpaper3dgen/Panel.gd'])
  })
})

describe('scriptScenePreloads', () => {
  it('extracts preloaded SCENE paths but not .gd helper scripts', () => {
    const content = '@tool\nextends Control\nvar a = preload("res://addons/x/Panel.tscn")\nvar b = preload("res://scenes/AnimRandomizer.gd")'
    expect(scriptScenePreloads(content)).toEqual(['res://addons/x/Panel.tscn'])
  })
})

describe('GodotAudienceIndex', () => {
  it('classifies a scene referencing an editor script as editor', () => {
    const index = new GodotAudienceIndex()
    index.registerScript('addons/animpaper3dgen/Panel.gd', classifyScriptAudience('@tool\nextends Control\nvar e = get_editor_interface()'))
    const result = index.classifyScene(
      'addons/animpaper3dgen/Panel.tscn',
      '[ext_resource type="Script" path="res://addons/animpaper3dgen/Panel.gd" id="1"]',
    )
    expect(result).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('classifies a scene preloaded by an editor script as editor', () => {
    const index = new GodotAudienceIndex()
    index.registerScript('addons/animpaper3dgen/plugin.gd', classifyScriptAudience('extends EditorPlugin'))
    index.registerEditorScene('res://addons/animpaper3dgen/Panel.tscn')
    const result = index.classifyScene('addons/animpaper3dgen/Panel.tscn', '[gd_scene]')
    expect(result).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('keeps a scene referencing a @tool-only script as uncertain (INCLUDED)', () => {
    const index = new GodotAudienceIndex()
    index.registerScript('addons/x/thing.gd', classifyScriptAudience('@tool\nextends Control'))
    const result = index.classifyScene(
      'addons/x/Thing.tscn',
      '[ext_resource type="Script" path="res://addons/x/thing.gd" id="1"]',
    )
    expect(result.audience).toBe('unknown')
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

  it('flags tests/ paths as test content', () => {
    const index = new GodotAudienceIndex()
    expect(index.classifyScene('addons/x/tests/debug_action.tscn', '[gd_scene]').audience).toBe('test')
  })

  it('flags inspector_plugin/ paths as editor', () => {
    const index = new GodotAudienceIndex()
    expect(index.classifyScene('addons/proton_scatter/src/stack/inspector_plugin/ui/stack_panel.tscn', '[gd_scene]')).toEqual({ audience: 'editor', reason: 'godot-editor-plugin' })
  })

  it('does NOT auto-exclude generic panel/ dock/ inspector/ pages/ paths', () => {
    const index = new GodotAudienceIndex()
    expect(index.classifyScene('ui/panel/settings/Panel.tscn', '[gd_scene]').audience).toBe('runtime')
    expect(index.classifyScene('inventory/panel/Inventory.tscn', '[gd_scene]').audience).toBe('runtime')
    expect(index.classifyScene('web/pages/profile.tscn', '[gd_scene]').audience).toBe('runtime')
    expect(index.classifyScene('ui/dock/Hotbar.tscn', '[gd_scene]').audience).toBe('runtime')
    expect(index.classifyPath('ui/inspector/details.tscn').audience).toBe('runtime')
  })
})

describe('normalizeGodotPath', () => {
  it('strips container prefix and res://', () => {
    expect(normalizeGodotPath('UntilThen.pck::addons/x/Panel.gd')).toBe('addons/x/Panel.gd')
    expect(normalizeGodotPath('res://addons/x/Panel.gd')).toBe('addons/x/Panel.gd')
    expect(normalizeGodotPath('addons/x/Panel.gd')).toBe('addons/x/Panel.gd')
  })
})
