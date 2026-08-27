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
  GenderValue,
} from './types'
import {
  explicitField,
  structuralInference,
  userMapped,
} from './provenance'

export type ContextFieldRole =
  | 'speaker'
  | 'listener'
  | 'speakerGender'
  | 'listenerGender'
  | 'grammaticalGender'
  | 'scene'
  | 'conversationId'
  | 'dialogueId'
  | 'nodeId'
  | 'parentNodeId'
  | 'choiceGroup'
  | 'voiceId'
  | 'audioAsset'
  | 'developerNote'
  | 'translatorNote'
  | 'translatableText'

export type ContextFieldMapping = {
  fieldName: string
  role: ContextFieldRole
}

const ALIASES: Record<ContextFieldRole, RegExp> = {
  speaker: /^(speaker|speaker_id|speakerid|talker|actor|actor_id|actorid|character|character_id|characterid|charactername|character_name|owner|from|sourceactor|voice|voice_id|who)$/iu,
  listener: /^(listener|listeners|listener_id|listenerid|target|targets|recipient|recipients|to|directedat|directed_at|audience|target_actor|targetactor)$/iu,
  speakerGender: /^(gender|sex|grammaticalgender|grammatical_gender|speakergender|speaker_gender|sex_code)$/iu,
  listenerGender: /^(listenergender|listener_gender|targetgender|target_gender|audiencegender)$/iu,
  grammaticalGender: /^(grammaticalgender|grammatical_gender|gramgender)$/iu,
  scene: /^(scene|scene_ref|sceneref|location|chapter|level|act)$/iu,
  conversationId: /^(conversation|conversationid|conversation_id|dialogue|dialogueid|dialogue_id|sequence)$/iu,
  dialogueId: /^(dialogueid|dialogue_id|lineid|line_id|node)$/iu,
  nodeId: /^(node|nodeid|node_id)$/iu,
  parentNodeId: /^(parent|parentnode|parent_node|parentid)$/iu,
  choiceGroup: /^(choicegroup|choice_group|choice-group|option_group|optiongroup)$/iu,
  voiceId: /^(voice|voiceid|voice_id|voiceline)$/iu,
  audioAsset: /^(audio|audioasset|audio_asset|sound|voice_clip|voiceclip)$/iu,
  developerNote: /^(note|notes|comment|devnote|developer_note|commentary)$/iu,
  translatorNote: /^(translator_note|translatornote|context_note|contextnote)$/iu,
  translatableText: /^(text|message|line|content|subtitle|spokentext|spoken_text|caption|localizedtext|localized_text|displaytext|display_text|value|choice|response|reply|answer|option|quote|utterance)$/iu,
}

/*
 * Look up a field's role by alias. Returns undefined when the field is not a
 * recognized context/text field (e.g. a structural ID, path, or hash).
 */
export function recognizeContextField(
  fieldName: string,
): ContextFieldRole | undefined {
  const normalized = fieldName.trim()
  for (const [role, pattern] of Object.entries(ALIASES)) {
    if (pattern.test(normalized)) {
      return role as ContextFieldRole
    }
  }
  return undefined
}

export function normalizeGender(
  value: unknown,
): GenderValue {
  if (value == null) return 'unknown'
  const text = String(value).trim().toLowerCase()
  if (text === '') return 'unknown'
  if (/^(m|male|masculine|he|him|0)$/u.test(text)) return 'male'
  if (/^(f|female|feminine|she|her|1)$/u.test(text)) return 'female'
  if (/^(n|neutral|neuter|they|them|2|other)$/u.test(text)) return 'neutral'
  if (text === 'unknown' || text === 'none') return 'unknown'
  return 'custom'
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

  const listeners: string[] = []
  const listenerGenders: GenderValue[] = []

  for (const [fieldName, value] of Object.entries(record)) {
    if (value == null) continue
    const resolved = resolveFieldRole(fieldName, mappings)
    if (!resolved) continue

    const { role, provenance: prov } = resolved
    const text = String(value)

    switch (role) {
      case 'speaker':
        context.speaker = text
        context.speakerProvenance = prov
        break
      case 'listener':
        listeners.push(text)
        break
      case 'speakerGender':
        context.speakerGender = normalizeGender(value)
        context.speakerGenderProvenance = prov
        break
      case 'listenerGender':
        listenerGenders.push(normalizeGender(value))
        break
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
      case 'developerNote':
        context.developerNote = text
        break
      case 'translatorNote':
        context.translatorNote = text
        break
      case 'translatableText':
        translatableFields.push({ field: fieldName, role })
        break
    }
  }

  if (listeners.length === 1) {
    context.listener = listeners[0]
    context.listenerProvenance = structuralInference('medium')
  } else if (listeners.length > 1) {
    context.listeners = listeners
    context.listenerProvenance = structuralInference('medium')
  }

  if (listenerGenders.length === 1) {
    context.listenerGender = listenerGenders[0]
    context.listenerGenderProvenance = structuralInference('medium')
  } else if (listenerGenders.length > 1) {
    context.listenerGenders = listenerGenders
  }

  return { context, translatableFields }
}
