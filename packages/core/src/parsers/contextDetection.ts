/*
 * Generic dialogue-context detection for ordinary data files (JSON/CSV/PO).
 *
 * The "Open File" path must preserve explicit speaker/listener/gender/context
 * already present in a file — it must NOT flatten a rich dialogue record into
 * only key + text.
 *
 * The detection is split into CONFIDENCE TIERS so a weak/fuzzy field name never
 * fabricates context:
 *
 *   HIGH confidence — exact shared semantic role aliases, auto-applied:
 *     speaker / speaker_name / speaker_id
 *     listener / listener_name / listener_id
 *     listeners / listener_ids
 *     speaker_gender / speaker_sex / listener_gender / listener_sex
 *     speaker_pronouns / listener_pronouns
 *     scene / scene_id
 *     conversation / conversation_id
 *     dialogue_id / line_id   (a LINE identity — NEVER collapsed into conversationId)
 *     node_id / node
 *     choice_group / voice / voice_id / audio / portrait / portrait_id
 *
 *   MEDIUM confidence — plausible but ambiguous; SUGGESTED in the mapping
 *     review but NOT auto-applied (require user confirmation):
 *     location / chapter / level / act → scene
 *     sprite / avatar → portrait
 *     gender / sex / pronouns → gender/pronouns
 *
 * Genders are normalized to the shared vocabulary (male/female/neutral/
 * unknown/custom) via `normalizeGender`, and the raw value is preserved.
 * Pronouns and gender are NEVER inferred from names/language/prose.
 */

import type {
  ParsedDialogueContext,
} from './types'

import { contextScalar, normalizeDialogueRoles, normalizeGender, participantObject as toCharacterValue, recognizeDialogueRole, type DialogueRole, type DialogueRoleField } from '../dialogueRoles'
import { explicitField, userMapped } from '../extraction/provenance'

/*
 * Normalize a field name the same way the JSON parser does: camelCase →
 * snake_case, dashes → underscores, lowercase.
 */
export function normalizeContextFieldName(fieldName: string): string {
  return fieldName.trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .toLowerCase()
}

/*
 * The generic-context roles a field may be mapped to (for the Import "Context
 * Mapping" review). Distinct from the extraction `ContextFieldRole`: this is a
 * focused, public-safe set for ordinary data files.
 */
export type GenericContextRole =
  | 'sourceText'
  | 'key'
  | 'speaker'
  | 'speakerId'
  | 'listener'
  | 'listenerId'
  | 'listeners'
  | 'listenerIds'
  | 'speakerGender'
  | 'listenerGender'
  | 'speakerPronouns'
  | 'listenerPronouns'
  | 'scene'
  | 'conversationId'
  | 'dialogueId'
  | 'nodeId'
  | 'choiceGroup'
  | 'voice'
  | 'portrait'
  | 'ignore'

export type GenericContextMapping = {
  field: string
  role: GenericContextRole
}

export type ContextDetectionConfidence = 'high' | 'medium' | 'low'

export type DetectedContextField = {
  field: string
  role: GenericContextRole
  confidence: ContextDetectionConfidence
  occurrenceCount: number
  sampleValues: string[]
}

/* ------------------------------------------------------------------ */
/* HIGH-confidence canonical field sets (auto-applied).                */
/* ------------------------------------------------------------------ */

const SPEAKER_PRONOUNS_FIELDS = new Set([
  'speaker_pronouns',
  'speakerpronouns',
])

const LISTENER_PRONOUNS_FIELDS = new Set([
  'listener_pronouns',
  'listenerpronouns',
])

const SCENE_FIELDS = new Set([
  'scene',
  'scene_id',
  'sceneid',
])

const CONVERSATION_FIELDS = new Set([
  'conversation',
  'conversation_id',
  'conversationid',
])

const DIALOGUE_ID_FIELDS = new Set([
  'dialogue_id',
  'dialogueid',
  'line_id',
  'lineid',
])

const NODE_FIELDS = new Set(['node', 'node_id', 'nodeid'])

const CHOICE_GROUP_FIELDS = new Set([
  'choice_group',
  'choicegroup',
  'option_group',
  'optiongroup',
])

const VOICE_FIELDS = new Set([
  'voice',
  'voice_id',
  'voiceid',
  'audio',
  'audio_asset',
  'voice_clip',
])

const PORTRAIT_FIELDS = new Set([
  'portrait',
  'portrait_id',
  'portraitid',
])

/*
 * MEDIUM-confidence suggestions — plausible but ambiguous. Reported in the
 * mapping review but NOT auto-applied.
 */
const MEDIUM_ROLE_SUGGESTIONS: Record<string, GenericContextRole> = {
  location: 'scene',
  chapter: 'scene',
  level: 'scene',
  act: 'scene',
  sprite: 'portrait',
  avatar: 'portrait',
  gender: 'speakerGender',
  sex: 'speakerGender',
  pronouns: 'speakerPronouns',
}

/*
 * Canonical role lookup for HIGH-confidence detection. Used by both
 * `detectDialogueContext` (auto-apply) and `detectContextFields` (report).
 */
function highConfidenceRole(normalized: string): GenericContextRole | undefined {
  const role = recognizeDialogueRole(normalized)
  if (role) return role
  if (SPEAKER_PRONOUNS_FIELDS.has(normalized)) return 'speakerPronouns'
  if (LISTENER_PRONOUNS_FIELDS.has(normalized)) return 'listenerPronouns'
  if (SCENE_FIELDS.has(normalized)) return 'scene'
  if (CONVERSATION_FIELDS.has(normalized)) return 'conversationId'
  if (DIALOGUE_ID_FIELDS.has(normalized)) return 'dialogueId'
  if (NODE_FIELDS.has(normalized)) return 'nodeId'
  if (CHOICE_GROUP_FIELDS.has(normalized)) return 'choiceGroup'
  if (VOICE_FIELDS.has(normalized)) return 'voice'
  if (PORTRAIT_FIELDS.has(normalized)) return 'portrait'
  return undefined
}

/*
 * A value that is an object with explicit id/name/gender keys (e.g.
 * `{ "id": "mark", "name": "Mark", "gender": "male" }`).
 */
export type CharacterValue = {
  id?: string
  name?: string
  gender?: string
  raw?: Record<string, unknown>
}

export type CharacterDatabase = Map<string, CharacterValue>

/*
 * Build a character database from a top-level `characters` / `people` /
 * `actors` object or array. Keys are the character ids (object keys or the
 * `id`/`name` field); values hold name + gender. Never guesses gender from
 * names — only explicit metadata.
 */
export function buildCharacterDatabase(value: unknown): CharacterDatabase {
  const db: CharacterDatabase = new Map()
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return db

  const record = value as Record<string, unknown>
  const source = record.characters ?? record.people ?? record.actors ?? record.speakers

  if (Array.isArray(source)) {
    for (const item of source) {
      const c = toCharacterValue(item)
      if (!c) continue
      if (c.id) db.set(c.id, c)
      if (c.name) db.set(c.name, c)
    }
  } else if (source !== null && typeof source === 'object' && !Array.isArray(source)) {
    for (const [key, item] of Object.entries(source as Record<string, unknown>)) {
      const c = toCharacterValue(item)
      if (c) {
        // In an object-form characters map, the object KEY is the structural
        // identifier for that character (e.g. `mark: { name: "Mark" }`). Only
        // an explicit `id` field overrides it.
        if (!c.id) c.id = key
        db.set(key, c)
        if (c.id) db.set(c.id, c)
        if (c.name) db.set(c.name, c)
      }
    }
  }

  return db
}

/*
 * Detect explicit dialogue context from a flat record.
 *
 * - HIGH-confidence canonical fields are auto-applied.
 * - MEDIUM-confidence fields (location/chapter/…) are preserved in `raw`
 *   but NOT auto-applied — they await user mapping.
 * - `mappings` (from the Import "Context Mapping" review) override aliases.
 * - A display name is NEVER promoted to a stable `speakerId`/`listenerId`; an
 *   ID is only set from an explicit id field or a character-record `id`.
 *
 * `characterDb` resolves names/ids to character records (name + gender) when a
 * character table is structurally present.
 */
export function detectDialogueContext(
  record: Record<string, unknown>,
  characterDb?: CharacterDatabase,
  mappings?: GenericContextMapping[],
): ParsedDialogueContext | undefined {
  const context: ParsedDialogueContext = {}
  const raw: Record<string, unknown> = {}
  const dialogueFields: DialogueRoleField[] = []
  const mappingByField = new Map((mappings ?? []).map((m) => [m.field.trim(), m.role]))
  for (const [fieldName, value] of Object.entries(record)) {
    const normalized = normalizeContextFieldName(fieldName)
    const mapped = mappingByField.get(fieldName.trim())
    const role = mapped ?? highConfidenceRole(normalized)
    const scalar = contextScalar(value)
    // Empty fields carry neither a role value nor provenance.
    if (value == null || value === '' || (Array.isArray(value) && !value.length)
      || (typeof value === 'object' && value !== null && !Object.keys(value).length)) continue
    if (role === 'ignore') continue
    if (role || Object.hasOwn(MEDIUM_ROLE_SUGGESTIONS, normalized)) raw[fieldName] = value
    if (!role) continue
    if (['speaker', 'speakerId', 'listener', 'listeners', 'listenerId', 'listenerIds', 'speakerGender', 'listenerGender'].includes(role)) {
      dialogueFields.push({ role: role as DialogueRole, value, provenance: mapped ? userMapped('high') : explicitField('high') })
      continue
    }
    if (scalar === undefined) continue
    switch (role) {
      case 'speakerPronouns': context.speakerPronouns = scalar; break
      case 'listenerPronouns': context.listenerPronouns = scalar; break
      case 'scene': context.scene = scalar; break
      case 'conversationId': context.conversationId = scalar; break
      case 'dialogueId': context.dialogueId = scalar; break
      case 'nodeId': context.nodeId = scalar; break
      case 'choiceGroup': context.choiceGroup = scalar; break
      case 'voice': context.voice = scalar; break
      case 'portrait': context.portrait = scalar; break
    }
  }
  Object.assign(context, normalizeDialogueRoles(dialogueFields))

  // Retain supported bare-gender evidence only for an actual speaker and only
  // when the user has not remapped/ignored that field.
  if (context.speaker && context.speakerGender === undefined) {
    for (const [field, value] of Object.entries(record)) {
      if (!mappingByField.has(field.trim()) && /^(gender|sex)$/u.test(normalizeContextFieldName(field)) && contextScalar(value) !== undefined) {
        context.speakerGender = normalizeGender(value)
        context.speakerGenderProvenance = explicitField('high')
      }
    }
  }

  // Character-table evidence fills missing fields; a good explicit display
  // name or explicit gender is never replaced by a database lookup.
  for (const side of ['speaker', 'listener'] as const) {
    const idKey = side === 'speaker' ? 'speakerId' : 'listenerId'
    const genderKey = side === 'speaker' ? 'speakerGender' : 'listenerGender'
    const genderProvenance = side === 'speaker' ? 'speakerGenderProvenance' : 'listenerGenderProvenance'
    const key = context[idKey] ?? context[side]
    if (side === 'listener' && context.listeners?.length) continue
    const character = key ? characterDb?.get(key) : undefined
    if (!character) continue
    if (character.name && (!context[side] || context[side] === key)) context[side] = character.name
    context[idKey] ??= character.id
    if (context[genderKey] === undefined && character.gender !== undefined) {
      context[genderKey] = normalizeGender(character.gender)
      context[genderProvenance] = explicitField('high')
    }
  }
  const hasAny = Object.values(context).some((value) => value !== undefined)
  if (!hasAny && !Object.keys(raw).length) return undefined
  if (Object.keys(raw).length) context.raw = raw
  return context
}

/*
 * Detect the structured-context FIELD ROLES present in a record array, for the
 * Import "Context Mapping" review. Returns each detected field with:
 *   - role (high-confidence canonical, or a MEDIUM-confidence suggestion)
 *   - confidence tier (high → safe auto-mapping; medium → suggest but review)
 *   - occurrence count and bounded sample values
 */
export function detectContextFields(
  records: Record<string, unknown>[],
): DetectedContextField[] {
  const acc = new Map<string, { role: GenericContextRole; confidence: ContextDetectionConfidence; count: number; samples: string[] }>()

  const order: string[] = []

  const bump = (
    fieldName: string,
    role: GenericContextRole,
    confidence: ContextDetectionConfidence,
    sample?: string,
  ) => {
    let item = acc.get(fieldName)
    if (!item) {
      item = { role, confidence, count: 0, samples: [] }
      acc.set(fieldName, item)
      order.push(fieldName)
    }
    item.count += 1
    if (sample !== undefined && sample !== '' && item.samples.length < 5 && !item.samples.includes(sample)) {
      item.samples.push(sample)
    }
  }

  for (const record of records) {
    for (const [fieldName, value] of Object.entries(record)) {
      const normalized = normalizeContextFieldName(fieldName)
      const highRole = highConfidenceRole(normalized)
      if (highRole) {
        bump(fieldName, highRole, 'high', typeof value === 'string' ? value : undefined)
        continue
      }
      const suggested = Object.hasOwn(MEDIUM_ROLE_SUGGESTIONS, normalized) ? MEDIUM_ROLE_SUGGESTIONS[normalized] : undefined
      if (suggested) {
        bump(fieldName, suggested, 'medium', typeof value === 'string' ? value : undefined)
      }
    }
  }

  return order.map((fieldName) => {
    const item = acc.get(fieldName)!
    return {
      field: fieldName,
      role: item.role,
      confidence: item.confidence,
      occurrenceCount: item.count,
      sampleValues: item.samples,
    }
  })
}

export type UnmappedField = {
  field: string
  occurrenceCount: number
  sampleValues: string[]
}

/*
 * Inventory the string-valued fields NOT recognized as high/medium context
 * candidates — the custom fields (`char_from`, `sex_a`, `body`, …) a user may
 * want to map. Bounded (≤40 fields, ≤5 samples each) so the review stays
 * readable for wide files.
 */
export function inspectUnmappedFields(
  records: Record<string, unknown>[],
  exclude: Set<string> = new Set(),
): UnmappedField[] {
  const acc = new Map<string, { count: number; samples: string[] }>()
  const order: string[] = []

  for (const record of records) {
    for (const [fieldName, value] of Object.entries(record)) {
      if (typeof value !== 'string') continue
      const normalized = normalizeContextFieldName(fieldName)
      if (highConfidenceRole(normalized)) continue
      if (Object.hasOwn(MEDIUM_ROLE_SUGGESTIONS, normalized)) continue
      if (exclude.has(fieldName)) continue

      let item = acc.get(fieldName)
      if (!item) {
        item = { count: 0, samples: [] }
        acc.set(fieldName, item)
        order.push(fieldName)
      }
      item.count += 1
      if (item.samples.length < 5 && !item.samples.includes(value)) item.samples.push(value)
    }
  }

  return order.slice(0, 40).map((fieldName) => {
    const item = acc.get(fieldName)!
    return { field: fieldName, occurrenceCount: item.count, sampleValues: item.samples }
  })
}
