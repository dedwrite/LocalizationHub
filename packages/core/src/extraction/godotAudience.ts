/*
 * Godot runtime-vs-editor audience classifier.
 *
 * Distinguishes player-facing runtime text from developer/editor/test tooling
 * WITHOUT a full Godot interpreter. Evidence is layered so we never exclude
 * real game text, only PROVEN tooling:
 *
 *   - A `.gd` script using `@tool` or `extends Editor*` (EditorPlugin,
 *     EditorInspectorPlugin, EditorProperty, EditorScript, GizmoPlugin,
 *     EditorImportPlugin, EditorScenePostImport, EditorExportPlugin, …) is
 *     editor tooling.
 *   - A `.tscn`/`.tres` scene that references such an editor script (via
 *     `[ext_resource type="Script" path=…]`) inherits editor audience.
 *   - Paths under editor-ish directories (`editor/`, `inspector_plugin/`,
 *     `gizmos_plugin/`, `dock`, `panel`, `documentation/`) are editor; paths
 *     under `tests/`, `test/`, `demos/`, `examples/` are test/demo.
 *   - `addons/<name>/` ALONE is NOT evidence (runtime addons like audio,
 *     controller-icons, or recording tooling genuinely ship player text).
 *
 * The classifier is per-RESOURCE (cached) so a runtime addon with an editor
 * plugin.gd keeps its runtime parts while its editor panels are excluded.
 */

import type { ContentAudience } from './types'

export type AudienceResult = {
  audience: ContentAudience
  reason?: string
}

/* `extends Editor*` classes only exist in the editor; they cannot run in a
 * shipped game. */
const EDITOR_CLASS_PATTERN =
  /extends\s+(Editor[A-Za-z]+|GizmoPlugin|VisualShaderNode)\b/u

const TOOL_PATTERN = /@tool\b/u

const EDITOR_INTERFACE_PATTERN =
  /\b(get_editor_interface|EditorInterface|EditorFileSystem|EditorSelection)\b/u

const TEST_PATH_PATTERN = /\/(tests?|demos?|examples?|samples?|fixtures?|documentation|pages)\//iu

const EDITOR_PATH_PATTERN =
  /\/(editor|inspector_plugin|gizmos_plugin|dock|panel|inspector|custom_import)\//iu

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
 * Classify a `.gd` script's audience from its source text. Returns the
 * audience and a reason, or `null` when it is runtime.
 */
export function classifyScriptAudience(content: string): AudienceResult | null {
  if (TOOL_PATTERN.test(content) || EDITOR_CLASS_PATTERN.test(content)) {
    return { audience: 'editor', reason: 'godot-editor-plugin' }
  }
  // Editor interface usage (e.g. get_editor_interface()) without @tool is still
  // editor tooling.
  if (EDITOR_INTERFACE_PATTERN.test(content)) {
    return { audience: 'editor', reason: 'godot-editor-plugin' }
  }
  return null
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
 * A per-resource audience index built over one scan. Scripts are registered
 * first (their audience + reason), then scenes are classified against the
 * registered editor scripts.
 */
export class GodotAudienceIndex {
  private readonly editorScriptKeys = new Set<string>()
  private readonly audienceByPath = new Map<string, AudienceResult>()

  /* Register a script's audience and remember its path/basename as editor. */
  registerScript(path: string, audience: AudienceResult | null): void {
    const result = audience ?? { audience: 'runtime' as ContentAudience }
    const key = normalizeGodotPath(path).toLowerCase()
    this.audienceByPath.set(key, result)
    if (result.audience === 'editor') {
      for (const k of godotPathKeys(path)) this.editorScriptKeys.add(k)
    }
  }

  isEditorScript(path: string): boolean {
    return this.editorScriptKeys.has(normalizeGodotPath(path).toLowerCase()) ||
      this.editorScriptKeys.has((normalizeGodotPath(path).split('/').pop() ?? '').toLowerCase())
  }

  scriptAudience(path: string): AudienceResult {
    const key = normalizeGodotPath(path).toLowerCase()
    return this.audienceByPath.get(key) ?? { audience: 'runtime' }
  }

  /* Classify a scene's audience from path + referenced editor scripts. */
  classifyScene(path: string, content: string): AudienceResult {
    // 1. Any referenced editor script → editor (highest confidence).
    for (const ref of sceneScriptReferences(content)) {
      const refNormalized = normalizeGodotPath(ref).toLowerCase()
      const refBase = (refNormalized.split('/').pop() ?? '').toLowerCase()
      if (this.editorScriptKeys.has(refNormalized) || this.editorScriptKeys.has(refBase)) {
        return { audience: 'editor', reason: 'godot-editor-plugin' }
      }
    }

    // 2. Editor-ish path segments.
    const normalized = normalizeGodotPath(path)
    if (EDITOR_PATH_PATTERN.test(normalized)) {
      return { audience: 'editor', reason: 'godot-editor-plugin' }
    }

    // 3. Test/demo path.
    if (TEST_PATH_PATTERN.test(normalized)) {
      return { audience: 'test', reason: 'test-resource' }
    }

    return { audience: 'runtime' }
  }

  /* Classify a non-script, non-scene resource (JSON/CSV/PO/etc.) by path. */
  classifyPath(path: string): AudienceResult {
    const normalized = normalizeGodotPath(path)
    if (TEST_PATH_PATTERN.test(normalized)) return { audience: 'test', reason: 'test-resource' }
    if (EDITOR_PATH_PATTERN.test(normalized)) return { audience: 'editor', reason: 'godot-editor-plugin' }
    return { audience: 'runtime' }
  }
}
