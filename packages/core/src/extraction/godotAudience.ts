/*
 * Godot runtime-vs-editor audience classifier.
 *
 * Distinguishes player-facing runtime text from developer/editor/test tooling.
 * AUTO-EXCLUSION REQUIRES HIGH-CONFIDENCE EVIDENCE — a weak heuristic may mark
 * an entry "uncertain" but must never automatically exclude player text:
 *
 *   STRONG editor evidence (→ editor, excluded):
 *     - `extends Editor*` (EditorPlugin, EditorInspectorPlugin, EditorProperty,
 *       EditorScript, EditorImportPlugin, EditorExportPlugin,
 *       EditorScenePostImport, EditorNode3DGizmoPlugin, …)
 *     - editor-only API usage: EditorInterface / get_editor_interface() /
 *       EditorFileSystem / EditorSelection
 *     - a scene preloaded by one of those editor scripts (the plugin's own UI
 *       scenes, e.g. plugin.gd → preload("Panel.tscn"))
 *     - highly-specific Godot editor path segments: editor_plugin/,
 *       inspector_plugin/, gizmos_plugin/
 *     - specific development path segments: tests/, test/, fixtures/,
 *       unit_tests/, demos/, examples/, samples/
 *
 *   WEAK evidence (→ uncertain/unknown, INCLUDED, never auto-excluded):
 *     - `@tool` ALONE (a runtime script may use @tool for editor preview while
 *       still running in the shipped game)
 *     - generic path segments: panel/, dock/, inspector/, editor/, pages/,
 *       documentation/ (these are ordinary runtime concepts in many games)
 *
 * Script preloads only propagate editor-ness to SCENES (`.tscn`/`.tres` UI),
 * never to `.gd` scripts — an editor panel may reuse a runtime helper script
 * (e.g. animpaper3dgen's Panel.gd preloads the runtime AnimRandomizer.gd).
 */

import type { ContentAudience } from './types'

export type AudienceResult = {
  audience: ContentAudience
  reason?: string
}

/* `extends Editor*` classes only exist in the editor; they cannot run in a
 * shipped game. */
const EDITOR_CLASS_PATTERN = /extends\s+Editor[A-Za-z0-9]+\b/u

/* Editor-only API usage. */
const EDITOR_INTERFACE_PATTERN =
  /\b(get_editor_interface|EditorInterface|EditorFileSystem|EditorSelection)\b/u

/* `@tool` means the script CAN run in the editor — NOT that it is absent from
 * runtime. On its own this is only WEAK evidence. */
const TOOL_PATTERN = /@tool\b/u

/* Highly-specific Godot editor-plugin directory segments. */
const EDITOR_PATH_PATTERN =
  /\/(editor_plugin|inspector_plugin|gizmos_plugin)\//iu

/* Specific development/test directory segments. */
const TEST_PATH_PATTERN = /\/(tests?|fixtures?|unit_tests?)\//iu

/* Demo/example/sample content — still auto-excluded, but audited: only a
 * specific segment, never a generic name. */
const DEMO_PATH_PATTERN = /\/(demos?|examples?|samples?)\//iu

/*
 * Normalize a provenance path for matching against `res://` references in
 * scenes: strip any archive container prefix (`X::`) and a leading `res://`.
 */
export function normalizeGodotPath(path: string): string {
  let p = path.replace(/\\/g, '/')
  const colon = p.indexOf('::')
  if (colon !== -1) p = p.slice(colon + 2)
  if (p.startsWith('res://')) p = p.slice(6)
  return p
}

/*
 * The basename (`Panel.gd`) is a second key so a scene's `res://…/Panel.gd`
 * reference matches the discovered script even when container prefixes differ.
 */
export function godotPathKeys(path: string): string[] {
  const normalized = normalizeGodotPath(path)
  const base = normalized.split('/').pop() ?? normalized
  return [normalized, normalized.toLowerCase(), base, base.toLowerCase()]
}

/*
 * Classify a `.gd` script's audience from its source text.
 *
 *   - strong editor evidence (extends Editor* / editor-only API) → editor
 *   - `@tool` alone → unknown (uncertain, included)
 *   - otherwise → runtime
 */
export function classifyScriptAudience(content: string): AudienceResult {
  if (EDITOR_CLASS_PATTERN.test(content) || EDITOR_INTERFACE_PATTERN.test(content)) {
    return { audience: 'editor', reason: 'godot-editor-plugin' }
  }
  if (TOOL_PATTERN.test(content)) {
    return { audience: 'unknown', reason: 'godot-tool-script' }
  }
  return { audience: 'runtime' }
}

/*
 * Extract the `res://` script paths referenced by a `.tscn`/`.tres` scene.
 */
export function sceneScriptReferences(content: string): string[] {
  const refs: string[] = []
  const pattern = /\[ext_resource[^\]]*type="Script"[^\]]*path="([^"]+)"/gu
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    refs.push(match[1])
  }
  return refs
}

/*
 * Extract the SCENE paths (`.tscn`/`.tres`) a `.gd` script preloads/loads.
 * These are the plugin's own UI panels, which inherit editor-ness when the
 * script is editor-only. `.gd` references are intentionally NOT returned
 * (an editor panel may reuse a runtime helper script).
 */
export function scriptScenePreloads(content: string): string[] {
  const refs: string[] = []
  const pattern = /(?:preload|load)\s*\(\s*"([^"]+\.(?:tscn|tres))"/gu
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    refs.push(match[1])
  }
  return refs
}

/*
 * A per-resource audience index built over one scan. Scripts are registered
 * first (their audience + reason), then scenes are classified against the
 * registered editor scripts and the editor-script preload graph.
 */
export class GodotAudienceIndex {
  private readonly editorScriptKeys = new Set<string>()
  private readonly uncertainScriptKeys = new Set<string>()
  private readonly editorSceneKeys = new Set<string>()
  private readonly audienceByPath = new Map<string, AudienceResult>()

  /* Register a script's audience and remember its path/basename. */
  registerScript(path: string, audience: AudienceResult): void {
    const key = normalizeGodotPath(path).toLowerCase()
    this.audienceByPath.set(key, audience)
    if (audience.audience === 'editor') {
      for (const k of godotPathKeys(path)) this.editorScriptKeys.add(k)
    } else if (audience.audience === 'unknown') {
      for (const k of godotPathKeys(path)) this.uncertainScriptKeys.add(k)
    }
  }

  /* Mark a scene as editor because an editor script preloads it. */
  registerEditorScene(path: string): void {
    for (const k of godotPathKeys(path)) this.editorSceneKeys.add(k)
  }

  isEditorScript(path: string): boolean {
    const n = normalizeGodotPath(path).toLowerCase()
    const base = n.split('/').pop() ?? ''
    return this.editorScriptKeys.has(n) || this.editorScriptKeys.has(base.toLowerCase())
  }

  isUncertainScript(path: string): boolean {
    const n = normalizeGodotPath(path).toLowerCase()
    const base = n.split('/').pop() ?? ''
    return this.uncertainScriptKeys.has(n) || this.uncertainScriptKeys.has(base.toLowerCase())
  }

  isEditorScene(path: string): boolean {
    const n = normalizeGodotPath(path).toLowerCase()
    const base = n.split('/').pop() ?? ''
    return this.editorSceneKeys.has(n) || this.editorSceneKeys.has(base.toLowerCase())
  }

  scriptAudience(path: string): AudienceResult {
    const key = normalizeGodotPath(path).toLowerCase()
    return this.audienceByPath.get(key) ?? { audience: 'runtime' }
  }

  /* Classify a scene's audience from path + referenced editor scripts. */
  classifyScene(path: string, content: string): AudienceResult {
    // 1. References an editor script → editor (highest confidence).
    for (const ref of sceneScriptReferences(content)) {
      if (this.isEditorScript(ref)) {
        return { audience: 'editor', reason: 'godot-editor-plugin' }
      }
    }

    // 2. Preloaded by an editor script (the plugin's own UI) → editor.
    if (this.isEditorScene(path)) {
      return { audience: 'editor', reason: 'godot-editor-plugin' }
    }

    // 3. Highly-specific editor path segments.
    const normalized = normalizeGodotPath(path)
    if (EDITOR_PATH_PATTERN.test(normalized)) {
      return { audience: 'editor', reason: 'godot-editor-plugin' }
    }

    // 4. Development/test path segments.
    if (TEST_PATH_PATTERN.test(normalized) || DEMO_PATH_PATTERN.test(normalized)) {
      return { audience: 'test', reason: 'test-resource' }
    }

    // 5. References a `@tool`-only (uncertain) script → uncertain, INCLUDED.
    for (const ref of sceneScriptReferences(content)) {
      if (this.isUncertainScript(ref)) {
        return { audience: 'unknown', reason: 'godot-tool-script' }
      }
    }

    return { audience: 'runtime' }
  }

  /* Classify a non-script, non-scene resource (JSON/CSV/PO/etc.) by path. */
  classifyPath(path: string): AudienceResult {
    const normalized = normalizeGodotPath(path)
    if (EDITOR_PATH_PATTERN.test(normalized)) return { audience: 'editor', reason: 'godot-editor-plugin' }
    if (TEST_PATH_PATTERN.test(normalized) || DEMO_PATH_PATTERN.test(normalized)) {
      return { audience: 'test', reason: 'test-resource' }
    }
    return { audience: 'runtime' }
  }
}
