import type { EntryContext, FieldProvenance, GenderValue } from './extraction/types'
import { isLosslessNumber, isNumber } from 'lossless-json'

/** Exact comparison only: separators/case vary, semantic words do not. */
export function normalizeDialogueFieldKey(field: string): string {
  return field.trim().toLowerCase().replace(/[ _-]+/gu, '')
}

export type DialogueRole = 'speaker' | 'speakerId' | 'listener' | 'listeners' | 'listenerId' | 'listenerIds' | 'speakerGender' | 'listenerGender'

const aliases = new Map<string, DialogueRole>()
const add = (role: DialogueRole, names: string[]) => names.forEach((name) => aliases.set(name, role))
const speakerRoots = ['speaker', 'talker', 'actor', 'character', 'sender', 'sourceactor', 'sourcecharacter']
const listenerRoots = ['listener', 'receiver', 'recipient', 'target', 'addressee', 'targetactor', 'targetcharacter', 'receiveractor', 'recipientactor']
add('speaker', [...speakerRoots, ...speakerRoots.map((name) => `${name}name`), 'from', 'who'])
add('speakerId', [...speakerRoots.map((name) => `${name}id`), 'speakerkey'])
add('listener', [...listenerRoots, ...listenerRoots.map((name) => `${name}name`), 'audience', 'to', 'directedat', 'addressedto'])
add('listeners', ['listeners', 'receivers', 'recipients', 'targets', 'audiences', 'addressees', 'listenernames'])
add('listenerId', listenerRoots.map((name) => `${name}id`))
add('listenerIds', listenerRoots.map((name) => `${name}ids`))
add('speakerGender', [...speakerRoots.map((name) => `${name}gender`), 'speakersex'])
add('listenerGender', [...listenerRoots.map((name) => `${name}gender`), 'audiencegender', 'listenersex', 'receiversex', 'listenergenders'])

export function recognizeDialogueRole(field: string): DialogueRole | undefined {
  return aliases.get(normalizeDialogueFieldKey(field))
}

export function normalizeGender(value: unknown): GenderValue {
  if (value == null) return 'unknown'
  const text = String(value).trim().toLowerCase()
  if (text === '') return 'unknown'
  if (/^(m|male|masculine|he|him|0)$/u.test(text)) return 'male'
  if (/^(f|female|feminine|she|her|1)$/u.test(text)) return 'female'
  if (/^(n|neutral|neuter|they|them|2|other)$/u.test(text)) return 'neutral'
  if (text === 'unknown' || text === 'none') return 'unknown'
  return 'custom'
}

export function contextScalar(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  // The ordinary JSON parser preserves numeric IDs beyond Number.MAX_SAFE_INTEGER.
  if (isLosslessNumber(value) && typeof value.value === 'string' && isNumber(value.value)) return value.value
  return undefined
}

export type Participant = { name?: string; id?: string; gender?: string; raw?: Record<string, unknown> }

/** One shallow participant object, only called under a recognized role/table. */
export function participantObject(value: unknown): Participant | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const fields = new Map(Object.entries(value).map(([key, child]) => [normalizeDialogueFieldKey(key), child]))
  const name = contextScalar(fields.get('displayname')) ?? contextScalar(fields.get('name'))
  const id = contextScalar(fields.get('id'))
  if (!name && !id) return undefined
  return { name, id, gender: contextScalar(fields.get('gender')) ?? contextScalar(fields.get('sex')), raw: value as Record<string, unknown> }
}

function listValues(value: unknown, plural: boolean): unknown[] {
  if (Array.isArray(value)) return value // deliberately no recursive crawler
  if (plural && typeof value === 'string') {
    const text = value.trim()
    if (text.startsWith('[')) {
      try { const list: unknown = JSON.parse(text); return Array.isArray(list) ? list : [] } catch { return [] }
    }
    return text.split(/[,;|\n]/u)
  }
  return [value]
}

export type DialogueRoleField = { role: DialogueRole; value: unknown; provenance: FieldProvenance }
type ProvenParticipant = Participant & { provenance: FieldProvenance }

function participantsFor(field: DialogueRoleField): ProvenParticipant[] {
  const idField = field.role === 'speakerId' || field.role === 'listenerId' || field.role === 'listenerIds'
  const plural = field.role === 'listeners' || field.role === 'listenerIds'
  return listValues(field.value, plural).flatMap((value) => {
    const scalar = contextScalar(value)
    const participant = scalar ? (idField || typeof value === 'number' || isLosslessNumber(value) ? { id: scalar } : { name: scalar }) : participantObject(value)
    return participant ? [{ ...participant, provenance: field.provenance }] : []
  })
}
function priority(provenance: FieldProvenance): number {
  return provenance.source === 'user-mapped' ? 3 : provenance.source === 'explicit-field' ? 2 : 1
}
function strongest<T extends { provenance: FieldProvenance }>(values: T[]): T[] {
  const rank = Math.max(...values.map((item) => priority(item.provenance)))
  return values.filter((item) => priority(item.provenance) === rank)
}
function deduplicate(values: ProvenParticipant[]): ProvenParticipant[] {
  const result: ProvenParticipant[] = []
  for (const value of values) {
    const existing = result.find((item) => (item.id && item.id === value.id)
      || (item.name && item.name === value.name && !(item.id && value.id && item.id !== value.id)))
    if (existing) {
      existing.id ??= value.id
      existing.name ??= value.name
      existing.gender ??= value.gender
    } else result.push({ ...value })
  }
  return result
}

/** Shared by ordinary-file parsing, engine extraction, and INKB headers. */
export function normalizeDialogueRoles(fields: DialogueRoleField[]): EntryContext & { listenerIds?: string[] } {
  const context: EntryContext & { listenerIds?: string[] } = {}
  for (const side of ['speaker', 'listener'] as const) {
    const nameRoles = side === 'speaker' ? ['speaker'] : ['listener', 'listeners']
    const idRoles = side === 'speaker' ? ['speakerId'] : ['listenerId', 'listenerIds']
    const named = deduplicate(strongest(fields.filter((f) => nameRoles.includes(f.role)).flatMap(participantsFor)))
    const ids = deduplicate(strongest(fields.filter((f) => idRoles.includes(f.role)).flatMap(participantsFor)))
    // Display names and stable identities occupy separate fields, independent
    // of source-key order. Only align plural IDs when the lengths agree.
    const people = named.length ? named : ids
    if (named.length === ids.length) people.forEach((person, index) => { person.id = ids[index].id ?? person.id })
    const genderFields = strongest(fields.filter((f) => f.role === `${side}Gender` && listValues(f.value, true).some((v) => contextScalar(v) !== undefined)))
    const genders = genderFields.flatMap((field) => listValues(field.value, true).flatMap((value) => {
      const text = contextScalar(value)
      return text === undefined ? [] : [{ value: normalizeGender(text), provenance: field.provenance }]
    }))
    const person = people[0]
    if (side === 'speaker') {
      if (people.length === 1) {
        context.speaker = person.name ?? person.id
        context.speakerId = person.id
        context.speakerProvenance = person.provenance
      }
      const gender = genders.at(-1) ?? (people.length === 1 && person.gender !== undefined ? { value: normalizeGender(person.gender), provenance: person.provenance } : undefined)
      if (gender) { context.speakerGender = gender.value; context.speakerGenderProvenance = gender.provenance }
    } else {
      if (people.length === 1) {
        context.listener = person.name ?? person.id
        context.listenerId = person.id
      } else if (people.length > 1) {
        // Deduplication already used identity; distinct IDs may share a name.
        // Keep the names, IDs and genders aligned in that case.
        context.listeners = people.map((p) => (p.name ?? p.id)!)
        if (people.every((p) => p.id)) context.listenerIds = people.map((p) => p.id!)
      }
      if (person) context.listenerProvenance = person.provenance
      if (people.length <= 1) {
        const gender = genders.at(-1) ?? (person?.gender !== undefined ? { value: normalizeGender(person.gender), provenance: person.provenance } : undefined)
        if (gender) { context.listenerGender = gender.value; context.listenerGenderProvenance = gender.provenance }
      } else if (genders.length === people.length) {
        context.listenerGenders = genders.map((g) => g.value)
        context.listenerGenderProvenance = genders[0].provenance
      } else if (!genders.length && people.some((p) => p.gender !== undefined)) {
        context.listenerGenders = people.map((p) => normalizeGender(p.gender))
        context.listenerGenderProvenance = person.provenance
      }
    }
  }
  return context
}
