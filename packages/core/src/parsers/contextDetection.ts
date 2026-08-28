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
 *   HIGH confidence — canonical, universally-safe names, auto-applied:
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
 *     who / talker / actor / character / character_name / from / sender → speaker
 *     target / to / addressee / recipient → listener
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

import {
  normalizeGender,
} from '../extraction/contextInference'

/*
 * Normalize a field name the same way the JSON parser does: camelCase →
 * snake_case, dashes → underscores, lowercase.
 */
export function normalizeContextFieldName(fieldName: string): string {
  return fieldName
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

const SPEAKER_ID_FIELDS = new Set([
  'speaker_id',
  'speakerid',
  'speaker_key',
  'speakerkey',
])

const SPEAKER_NAME_FIELDS = new Set([
  'speaker',
  'speaker_name',
  'speakername',
])

const LISTENER_ID_FIELDS = new Set([
  'listener_id',
  'listenerid',
])

const LISTENER_NAME_FIELDS = new Set([
  'listener',
  'listener_name',
  'listenername',
])

const LISTENERS_FIELDS = new Set([
  'listeners',
  'listener_names',
  'listenernames',
])

const LISTENER_IDS_FIELDS = new Set([
  'listener_ids',
  'listenerids',
  'target_ids',
  'targetids',
])

const SPEAKER_GENDER_FIELDS = new Set([
  'speaker_gender',
  'speakergender',
  'speaker_sex',
  'speakersex',
])

const LISTENER_GENDER_FIELDS = new Set([
  'listener_gender',
  'listenergender',
  'listener_sex',
  'listenersex',
])

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
  who: 'speaker',
  talker: 'speaker',
  actor: 'speaker',
  character: 'speaker',
  character_name: 'speaker',
  from: 'speaker',
  sender: 'speaker',
  target: 'listener',
  to: 'listener',
  addressee: 'listener',
  recipient: 'listener',
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
  if (SPEAKER_ID_FIELDS.has(normalized)) return 'speakerId'
  if (SPEAKER_NAME_FIELDS.has(normalized)) return 'speaker'
  if (LISTENER_ID_FIELDS.has(normalized)) return 'listenerId'
  if (LISTENER_NAME_FIELDS.has(normalized)) return 'listener'
  if (LISTENERS_FIELDS.has(normalized)) return 'listeners'
  if (LISTENER_IDS_FIELDS.has(normalized)) return 'listenerIds'
  if (SPEAKER_GENDER_FIELDS.has(normalized)) return 'speakerGender'
  if (LISTENER_GENDER_FIELDS.has(normalized)) return 'listenerGender'
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

function toCharacterValue(value: unknown): CharacterValue | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name : undefined
  const id = typeof record.id === 'string' || typeof record.id === 'number'
    ? String(record.id)
    : undefined
  const gender = typeof record.gender === 'string' || typeof record.sex === 'string'
    ? String(record.gender ?? record.sex)
    : undefined
  // Only treat as a character object if it has at least id or name.
  if (id === undefined && name === undefined) return undefined
  return { id, name, gender, raw: record }
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

/* Split a comma/semicolon/newline-separated string or a JSON array into parts. */
function splitListValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean)
      } catch {
        // fall through to separator split
      }
    }
    return trimmed.split(/[,;|\n]/u).map((s) => s.trim()).filter(Boolean)
  }
  return []
}

/*
 * Detect explicit dialogue context from a flat record.
 *
 * - HIGH-confidence canonical fields are auto-applied.
 * - MEDIUM-confidence fields (who/location/chapter/…) are preserved in `raw`
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

  let speakerName: string | undefined
  let speakerId: string | undefined
  let listenerName: string | undefined
  let listenerId: string | undefined
  let listeners: string[] | undefined
  let listenerIds: string[] | undefined
  let speakerGender: string | undefined
  let listenerGender: string | undefined
  let speakerPronouns: string | undefined
  let listenerPronouns: string | undefined
  let hasSpeakerField = false

  const mappingByField = new Map<string, GenericContextRole>()
  for (const m of mappings ?? []) mappingByField.set(m.field.trim(), m.role)

  const assign = (role: GenericContextRole, value: unknown, fieldName: string) => {
    const stringValue = typeof value === 'string' ? value : (typeof value === 'number' ? String(value) : undefined)
    switch (role) {
      case 'speakerId':
        hasSpeakerField = true
        if (stringValue !== undefined) speakerId = stringValue
        raw[fieldName] = value
        break
      case 'speaker': {
        hasSpeakerField = true
        const c = toCharacterValue(value)
        if (c) {
          speakerName = c.name ?? c.id
          speakerId = c.id
          if (c.gender) speakerGender = normalizeGender(c.gender)
        } else if (stringValue !== undefined) {
          speakerName = stringValue
        }
        raw[fieldName] = value
        break
      }
      case 'listenerId':
        if (stringValue !== undefined) listenerId = stringValue
        raw[fieldName] = value
        break
      case 'listener': {
        const c = toCharacterValue(value)
        if (c) {
          listenerName = c.name ?? c.id
          listenerId = c.id
          if (c.gender) listenerGender = normalizeGender(c.gender)
        } else if (stringValue !== undefined) {
          listenerName = stringValue
        }
        raw[fieldName] = value
        break
      }
      case 'listeners':
        listeners = splitListValue(value)
        raw[fieldName] = value
        break
      case 'listenerIds':
        listenerIds = splitListValue(value)
        raw[fieldName] = value
        break
      case 'speakerGender':
        hasSpeakerField = true
        speakerGender = normalizeGender(value)
        raw[fieldName] = value
        break
      case 'listenerGender':
        listenerGender = normalizeGender(value)
        raw[fieldName] = value
        break
      case 'speakerPronouns':
        if (stringValue !== undefined) speakerPronouns = stringValue
        raw[fieldName] = value
        break
      case 'listenerPronouns':
        if (stringValue !== undefined) listenerPronouns = stringValue
        raw[fieldName] = value
        break
      case 'scene':
        if (stringValue !== undefined) context.scene = stringValue
        raw[fieldName] = value
        break
      case 'conversationId':
        if (stringValue !== undefined) context.conversationId = stringValue
        raw[fieldName] = value
        break
      case 'dialogueId':
        if (stringValue !== undefined) context.dialogueId = stringValue
        raw[fieldName] = value
        break
      case 'nodeId':
        if (stringValue !== undefined) context.nodeId = stringValue
        raw[fieldName] = value
        break
      case 'choiceGroup':
        if (stringValue !== undefined) context.choiceGroup = stringValue
        raw[fieldName] = value
        break
      case 'voice':
        if (stringValue !== undefined) context.voice = stringValue
        raw[fieldName] = value
        break
      case 'portrait':
        if (stringValue !== undefined) context.portrait = stringValue
        raw[fieldName] = value
        break
      case 'ignore':
        break
      default:
        break
    }
  }

  for (const [fieldName, value] of Object.entries(record)) {
    const normalized = normalizeContextFieldName(fieldName)

    const explicitRole = mappingByField.get(fieldName)
    if (explicitRole) {
      assign(explicitRole, value, fieldName)
      continue
    }

    const highRole = highConfidenceRole(normalized)
    if (highRole) {
      assign(highRole, value, fieldName)
      continue
    }

    // MEDIUM-confidence suggestions: preserve raw but do NOT auto-apply.
    if (MEDIUM_ROLE_SUGGESTIONS[normalized]) {
      raw[fieldName] = value
    }
  }

  // A bare gender/sex is attributed to the speaker only when a speaker field
  // is ALSO present (structural evidence); otherwise it stays raw.
  if (speakerGender === undefined && hasSpeakerField) {
    const bareGender = record.gender ?? record.sex
    if (bareGender !== undefined) {
      speakerGender = normalizeGender(bareGender)
    }
  }

  // Resolve names/ids against the character database. An ID is ONLY set from
  // the character record's own `id` — a display name is never promoted to an ID.
  if (characterDb && characterDb.size > 0) {
    const speakerKey = speakerId ?? speakerName
    if (speakerKey !== undefined) {
      const c = characterDb.get(speakerKey)
      if (c) {
        if (c.name) speakerName = c.name
        if (c.id) speakerId = c.id
        if (speakerGender === undefined && c.gender) speakerGender = normalizeGender(c.gender)
      }
    }
    const listenerKey = listenerId ?? listenerName
    if (listenerKey !== undefined) {
      const c = characterDb.get(listenerKey)
      if (c) {
        if (c.name) listenerName = c.name
        if (c.id) listenerId = c.id
        if (listenerGender === undefined && c.gender) listenerGender = normalizeGender(c.gender)
      }
    }
  }

  context.speaker = speakerName
  context.speakerId = speakerId
  context.listener = listenerName
  context.listenerId = listenerId
  context.listeners = listeners
  context.listenerIds = listenerIds
  context.speakerGender = speakerGender
  context.listenerGender = listenerGender
  context.speakerPronouns = speakerPronouns
  context.listenerPronouns = listenerPronouns

  const hasAny = Object.entries(context).some(([k, v]) => k !== 'raw' && v !== undefined)
  if (!hasAny && Object.keys(raw).length === 0) return undefined

  if (Object.keys(raw).length > 0) context.raw = raw
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
      const suggested = MEDIUM_ROLE_SUGGESTIONS[normalized]
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
      if (MEDIUM_ROLE_SUGGESTIONS[normalized]) continue
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
