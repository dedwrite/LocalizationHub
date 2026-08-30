/*
 * Context field mapping and speaker/listener/gender inference.
 *
 * Recognizes common structured concepts (speaker, listener, gender, scene,
 * conversation, text) via field-name aliases, sibling structure, and value
 * patterns — and allows user-defined mappings for custom schemas. All inferred
 * fields carry provenance and confidence.
 */

import type {
  EntryContext,
  FieldProvenance,
} from './types'
import { normalizeDialogueRoles, normalizeGender, recognizeDialogueRole, type DialogueRole, type DialogueRoleField } from '../dialogueRoles'
export { normalizeGender } from '../dialogueRoles'
import {
  explicitField,
  userMapped,
} from './provenance'

export type ContextFieldRole =
  | DialogueRole
  | 'grammaticalGender'
  | 'scene'
  | 'conversationId'
  | 'dialogueId'
  | 'nodeId'
  | 'parentNodeId'
  | 'choiceGroup'
  | 'voiceId'
  | 'audioAsset'
  | 'portrait'
  | 'developerNote'
  | 'translatorNote'
  | 'translatableText'
  /*
   * Explicitly ignore a field: never produce a translation entry from it and
   * never treat it as context. Used for user mappings that mark structural
   * fields (IDs, timestamps, internal flags) as non-localization data.
   */
  | 'ignore'

export type ContextFieldMapping = {
  fieldName: string
  role: ContextFieldRole
}

const ALIASES: Partial<Record<ContextFieldRole, RegExp>> = {
  speakerGender: /^(gender|sex|sexcode|sex_code)$/iu,
  grammaticalGender: /^(grammaticalgender|grammatical_gender|gramgender)$/iu,
  scene: /^(scene|scene_ref|sceneref|location|chapter|level|act)$/iu,
  conversationId: /^(conversation|conversationid|conversation_id|dialogue|dialogueid|dialogue_id|sequence)$/iu,
  dialogueId: /^(dialogueid|dialogue_id|lineid|line_id|node)$/iu,
  nodeId: /^(node|nodeid|node_id)$/iu,
  parentNodeId: /^(parent|parentnode|parent_node|parentid)$/iu,
  choiceGroup: /^(choicegroup|choice_group|choice-group|option_group|optiongroup)$/iu,
  voiceId: /^(voice|voiceid|voice_id|voiceline)$/iu,
  audioAsset: /^(audio|audioasset|audio_asset|sound|voice_clip|voiceclip)$/iu,
  portrait: /^(portrait|portrait_id|portraitid|portrait_asset|portraitasset)$/iu,
  developerNote: /^(note|notes|comment|devnote|developer_note|commentary)$/iu,
  translatorNote: /^(translator_note|translatornote|context_note|contextnote)$/iu,
  translatableText: /^(text|message|line|content|subtitle|spokentext|spoken_text|caption|localizedtext|localized_text|displaytext|display_text|value|choice|response|reply|answer|option|quote|utterance)$/iu,
  // "ignore" has no built-in alias — it is only assigned via user field mapping.
  ignore: /^$/,
}

/*
 * Look up a field's role by alias. Returns undefined when the field is not a
 * recognized context/text field (e.g. a structural ID, path, or hash).
 */
export function recognizeContextField(
  fieldName: string,
): ContextFieldRole | undefined {
  const dialogueRole = recognizeDialogueRole(fieldName)
  if (dialogueRole) return dialogueRole
  // Non-participant aliases retain their existing compatibility rules.
  const normalized = fieldName.trim()
  for (const [role, pattern] of Object.entries(ALIASES)) {
    // "ignore" is never auto-recognized; it is only assigned by user mapping.
    if (role === 'ignore') continue
    if (pattern.test(normalized)) {
      return role as ContextFieldRole
    }
  }
  return undefined
}

/*
 * Resolve the effective field mapping for a dataset: built-in aliases first,
 * then any user-defined mapping (which overrides aliases). Used so custom
 * engine schemas built on top of Unreal/Godot/Unity remain extractable.
 */
export function resolveFieldRole(
  fieldName: string,
  mappings: ContextFieldMapping[] = [],
): { role: ContextFieldRole; provenance: FieldProvenance } | undefined {
  const normalized = fieldName.trim()
  const explicit = mappings.find(
    (mapping) => mapping.fieldName.trim() === normalized,
  )
  if (explicit) {
    return { role: explicit.role, provenance: userMapped('high') }
  }

  const role = recognizeContextField(normalized)
  if (role) {
    return { role, provenance: explicitField('high') }
  }

  return undefined
}

/*
 * Infer a full `EntryContext` from a flat record (object of fieldName → value).
 *
 * `textValues` is a precomputed list of `{ field, role }` for the record's
 * translatable text fields (so we can link `previousEntryId`/`nextEntryId`
 * later at the conversation level, not here).
 */
export function inferContextFromRecord(
  record: Record<string, unknown>,
  mappings: ContextFieldMapping[] = [],
): { context: EntryContext; translatableFields: Array<{ field: string; role: ContextFieldRole }> } {
  const context: EntryContext = {}
  const translatableFields: Array<{ field: string; role: ContextFieldRole }> = []

  const dialogueFields: DialogueRoleField[] = []

  for (const [fieldName, value] of Object.entries(record)) {
    if (value == null) continue
    const resolved = resolveFieldRole(fieldName, mappings)
    if (!resolved) continue

    const { role, provenance: prov } = resolved
    if (['speaker', 'speakerId', 'listener', 'listeners', 'listenerId', 'listenerIds', 'speakerGender', 'listenerGender'].includes(role)) {
      dialogueFields.push({ role: role as DialogueRole, value, provenance: prov })
      continue
    }
    const text = String(value)

    switch (role) {
      case 'grammaticalGender':
        context.grammaticalGender = normalizeGender(value)
        break
      case 'scene':
        context.scene = text
        break
      case 'conversationId':
        context.conversationId = text
        context.conversationProvenance = prov
        break
      case 'dialogueId':
        context.dialogueId = text
        break
      case 'nodeId':
        context.nodeId = text
        break
      case 'parentNodeId':
        context.parentNodeId = text
        break
      case 'choiceGroup':
        context.choiceGroup = text
        break
      case 'voiceId':
        context.voiceId = text
        break
      case 'audioAsset':
        context.audioAsset = text
        break
      case 'portrait':
        context.portrait = text
        break
      case 'developerNote':
        context.developerNote = text
        break
      case 'translatorNote':
        context.translatorNote = text
        break
      case 'translatableText':
        translatableFields.push({ field: fieldName, role })
        break
      case 'ignore':
        // Explicitly ignored: no translation entry, no context. Skip entirely.
        break
    }
  }

  const { listenerIds: _pluralIds, ...dialogue } = normalizeDialogueRoles(dialogueFields)
  Object.assign(context, dialogue) // EntryContext has no plural ID field.

  return { context, translatableFields }
}
