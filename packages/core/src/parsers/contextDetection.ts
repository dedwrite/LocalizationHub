/*
 * Generic dialogue-context detection for ordinary data files (JSON/CSV/PO).
 *
 * The "Open File" path must preserve explicit speaker/listener/gender/context
 * already present in a file — it must NOT flatten a rich dialogue record into
 * only key + text. This module detects explicit fields WITHOUT guessing:
 *
 *   - speaker/speakerId/talker/actor/character/from/sender → speaker
 *   - listener/listenerId/addressee/recipient/target/to → listener
 *   - speaker_gender/speakerSex/speaker_sex → speakerGender
 *   - listener_gender/listenerSex/listener_sex → listenerGender
 *   - scene/scene_id/conversation/conversation_id/dialogue_id/node_id/
 *     choice_group/voice/audio/portrait → the corresponding context field
 *
 * Genders are normalized to the shared vocabulary (male/female/neutral/
 * unknown/custom) via `normalizeGender`, and the raw value is preserved.
 *
 * A bare `gender`/`sex` field is only treated as the SPEAKER's gender when an
 * explicit speaker field is also present (structural evidence); otherwise it is
 * left as raw metadata rather than silently guessed.
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

const SPEAKER_ID_FIELDS = new Set([
  'speaker_id',
  'speakerid',
  'speaker_key',
  'talker_id',
  'actor_id',
  'character_id',
  'characterid',
])

const SPEAKER_NAME_FIELDS = new Set([
  'speaker',
  'speaker_name',
  'speakername',
  'talker',
  'actor',
  'character',
  'character_name',
  'charactername',
  'from',
  'sender',
  'who',
])

const LISTENER_ID_FIELDS = new Set([
  'listener_id',
  'listenerid',
  'addressee_id',
  'recipient_id',
  'target_id',
])

const LISTENER_NAME_FIELDS = new Set([
  'listener',
  'listener_name',
  'listenername',
  'addressee',
  'recipient',
  'target',
  'to',
])

const SPEAKER_GENDER_FIELDS = new Set([
  'speaker_gender',
  'speakergender',
  'speaker_sex',
  'speakersex',
  'actor_gender',
])

const LISTENER_GENDER_FIELDS = new Set([
  'listener_gender',
  'listenergender',
  'listener_sex',
  'listenersex',
  'target_gender',
])

const SCENE_FIELDS = new Set([
  'scene',
  'scene_id',
  'sceneid',
  'location',
  'chapter',
  'level',
  'act',
])

const CONVERSATION_FIELDS = new Set([
  'conversation',
  'conversation_id',
  'conversationid',
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
  'sprite',
  'avatar',
])

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
        db.set(key, c)
        if (c.id) db.set(c.id, c)
        if (c.name) db.set(c.name, c)
      }
    }
  }

  return db
}

/*
 * Detect explicit dialogue context from a flat record (object of fieldName →
 * value). `characterDb` optionally resolves speaker/listener IDs to names and
 * genders. Returns undefined when no context is present.
 */
export function detectDialogueContext(
  record: Record<string, unknown>,
  characterDb?: CharacterDatabase,
): ParsedDialogueContext | undefined {
  const context: ParsedDialogueContext = {}
  const raw: Record<string, unknown> = {}

  let speakerName: string | undefined
  let speakerId: string | undefined
  let listenerName: string | undefined
  let listenerId: string | undefined
  let speakerGender: string | undefined
  let listenerGender: string | undefined
  let hasSpeakerField = false

  for (const [fieldName, value] of Object.entries(record)) {
    const normalized = normalizeContextFieldName(fieldName)
    const stringValue = typeof value === 'string' ? value : (typeof value === 'number' ? String(value) : undefined)

    if (SPEAKER_ID_FIELDS.has(normalized)) {
      hasSpeakerField = true
      speakerId = stringValue
      raw[fieldName] = value
    } else if (SPEAKER_NAME_FIELDS.has(normalized)) {
      hasSpeakerField = true
      const c = toCharacterValue(value)
      if (c) {
        speakerName = c.name ?? c.id
        speakerId = c.id
        if (c.gender) speakerGender = normalizeGender(c.gender)
        raw[fieldName] = value
      } else if (stringValue !== undefined) {
        speakerName = stringValue
        raw[fieldName] = value
      }
    } else if (LISTENER_ID_FIELDS.has(normalized)) {
      listenerId = stringValue
      raw[fieldName] = value
    } else if (LISTENER_NAME_FIELDS.has(normalized)) {
      const c = toCharacterValue(value)
      if (c) {
        listenerName = c.name ?? c.id
        listenerId = c.id
        if (c.gender) listenerGender = normalizeGender(c.gender)
        raw[fieldName] = value
      } else if (stringValue !== undefined) {
        listenerName = stringValue
        raw[fieldName] = value
      }
    } else if (SPEAKER_GENDER_FIELDS.has(normalized)) {
      hasSpeakerField = true
      speakerGender = normalizeGender(value)
      raw[fieldName] = value
    } else if (LISTENER_GENDER_FIELDS.has(normalized)) {
      listenerGender = normalizeGender(value)
      raw[fieldName] = value
    } else if (normalized === 'gender' || normalized === 'sex') {
      // A bare gender/sex is only attributed to the speaker when a speaker
      // field is ALSO present; otherwise it stays raw (no guess).
      raw[fieldName] = value
    } else if (SCENE_FIELDS.has(normalized) && stringValue !== undefined) {
      context.scene = stringValue
      raw[fieldName] = value
    } else if (CONVERSATION_FIELDS.has(normalized) && stringValue !== undefined) {
      context.conversationId = context.conversationId ?? stringValue
      raw[fieldName] = value
    } else if (NODE_FIELDS.has(normalized) && stringValue !== undefined) {
      context.nodeId = stringValue
      raw[fieldName] = value
    } else if (CHOICE_GROUP_FIELDS.has(normalized) && stringValue !== undefined) {
      context.choiceGroup = stringValue
      raw[fieldName] = value
    } else if (VOICE_FIELDS.has(normalized) && stringValue !== undefined) {
      context.voice = stringValue
      raw[fieldName] = value
    } else if (PORTRAIT_FIELDS.has(normalized) && stringValue !== undefined) {
      context.portrait = stringValue
      raw[fieldName] = value
    }
  }

  // Bare gender attributed to speaker only with structural speaker evidence.
  if (speakerGender === undefined && hasSpeakerField) {
    const bareGender = record.gender ?? record.sex
    if (bareGender !== undefined) {
      speakerGender = normalizeGender(bareGender)
    }
  }

  // Resolve speaker/listener IDs against the character database.
  if (characterDb && characterDb.size > 0) {
    if (speakerId === undefined && speakerName !== undefined) speakerId = speakerName
    if (speakerId !== undefined) {
      const c = characterDb.get(speakerId)
      if (c) {
        // Prefer the character record's name over the raw id/name so a file
        // with `speaker: "mark"` + `characters.mark.name = "Mark"` resolves to
        // the display name "Mark".
        if (c.name) speakerName = c.name
        else if (speakerName === undefined) speakerName = c.id ?? speakerId
        if (speakerGender === undefined && c.gender) speakerGender = normalizeGender(c.gender)
      }
    }
    if (listenerId === undefined && listenerName !== undefined) listenerId = listenerName
    if (listenerId !== undefined) {
      const c = characterDb.get(listenerId)
      if (c) {
        if (c.name) listenerName = c.name
        else if (listenerName === undefined) listenerName = c.id ?? listenerId
        if (listenerGender === undefined && c.gender) listenerGender = normalizeGender(c.gender)
      }
    }
  }

  context.speaker = speakerName
  context.speakerId = speakerId
  context.listener = listenerName
  context.listenerId = listenerId
  context.speakerGender = speakerGender
  context.listenerGender = listenerGender

  const hasAny = Object.entries(context).some(([k, v]) => k !== 'raw' && v !== undefined)
  if (!hasAny && Object.keys(raw).length === 0) return undefined

  if (Object.keys(raw).length > 0) context.raw = raw
  return context
}

/*
 * Detect the structured-context FIELD ROLES present in a record array, for the
 * Import "Context Mapping" review. Returns fieldName → role pairs so the UI can
 * show "Detected field / sample values / role" without re-deriving them.
 */
export function detectContextFields(
  records: Record<string, unknown>[],
): Array<{ field: string; role: string }> {
  const seen = new Map<string, string>()
  const roles: Array<{ field: string; role: string }> = []

  for (const record of records) {
    for (const fieldName of Object.keys(record)) {
      const normalized = normalizeContextFieldName(fieldName)
      let role: string | undefined
      if (SPEAKER_ID_FIELDS.has(normalized)) role = 'speakerId'
      else if (SPEAKER_NAME_FIELDS.has(normalized)) role = 'speaker'
      else if (LISTENER_ID_FIELDS.has(normalized)) role = 'listenerId'
      else if (LISTENER_NAME_FIELDS.has(normalized)) role = 'listener'
      else if (SPEAKER_GENDER_FIELDS.has(normalized)) role = 'speakerGender'
      else if (LISTENER_GENDER_FIELDS.has(normalized)) role = 'listenerGender'
      else if (SCENE_FIELDS.has(normalized)) role = 'scene'
      else if (CONVERSATION_FIELDS.has(normalized)) role = 'conversationId'
      else if (NODE_FIELDS.has(normalized)) role = 'nodeId'
      else if (CHOICE_GROUP_FIELDS.has(normalized)) role = 'choiceGroup'
      else if (VOICE_FIELDS.has(normalized)) role = 'voice'
      else if (PORTRAIT_FIELDS.has(normalized)) role = 'portrait'

      if (role && !seen.has(fieldName)) {
        seen.set(fieldName, role)
        roles.push({ field: fieldName, role })
      }
    }
  }

  return roles
}
