import { describe, expect, it } from 'vitest'
import { inferContextFromRecord, recognizeContextField } from './extraction/contextInference'
import { detectContextFields, detectDialogueContext } from './parsers/contextDetection'
import { parseLocalizationFile } from './parsers'
import { extractGodot } from './extraction/engines/godot'

const explicit = { source: 'explicit-field', confidence: 'high' }
const aliases = {
  speaker: ['speaker', 'speaker_name', 'talker', 'talker_name', 'actor', 'actor_name', 'character', 'character_name', 'sender', 'sender_name', 'from', 'who', 'source_actor', 'source_character'],
  speakerId: ['speaker_id', 'talker_id', 'actor_id', 'character_id', 'sender_id', 'source_actor_id', 'source_character_id'],
  listener: ['listener', 'listener_name', 'receiver', 'receiver_name', 'recipient', 'recipient_name', 'target', 'target_name', 'audience', 'addressee', 'addressee_name', 'to', 'directed_at', 'addressed_to', 'target_actor', 'target_character', 'receiver_actor', 'recipient_actor'],
  listenerId: ['listener_id', 'receiver_id', 'recipient_id', 'target_id', 'addressee_id', 'target_actor_id', 'target_character_id', 'receiver_actor_id', 'recipient_actor_id'],
  speakerGender: ['speaker_gender', 'speaker_sex', 'talker_gender', 'actor_gender', 'character_gender', 'sender_gender', 'source_actor_gender'],
  listenerGender: ['listener_gender', 'listener_sex', 'receiver_gender', 'receiver_sex', 'recipient_gender', 'target_gender', 'audience_gender', 'addressee_gender', 'target_actor_gender', 'target_character_gender'],
} as const

function variants(alias: string): string[] {
  const words = alias.split('_')
  const capitalized = words.map((word) => word[0].toUpperCase() + word.slice(1))
  return [...new Set([alias, words[0] + capitalized.slice(1).join(''), capitalized.join(''), words.join('-'), words.join(' '), alias.toUpperCase(), ` ${alias} `])]
}
const readers = [
  { name: 'extraction', read: (record: Record<string, unknown>) => inferContextFromRecord(record).context },
  { name: 'ordinary files', read: (record: Record<string, unknown>) => detectDialogueContext(record) },
]

describe.each(readers)('shared dialogue roles: $name', ({ read }) => {
  for (const [role, keys] of Object.entries(aliases)) {
    it.each(keys)(`recognizes exact ${role} alias %s in all casing/separator variants`, (alias) => {
      for (const key of variants(alias)) {
        const value = role.endsWith('Gender') ? 'F' : 'actor-value'
        const context = read({ [key]: value })
        expect(context).toMatchObject({ [role]: role.endsWith('Gender') ? 'female' : value })
        const provenance = role.startsWith('speaker') ? (role.endsWith('Gender') ? 'speakerGenderProvenance' : 'speakerProvenance') : (role.endsWith('Gender') ? 'listenerGenderProvenance' : 'listenerProvenance')
        expect(context).toMatchObject({ [provenance]: explicit })
        expect(detectContextFields([{ [key]: value }])[0]).toMatchObject({ role, confidence: 'high' })
      }
    })
  }

  it.each(['listeners', 'receivers', 'recipients', 'targets', 'audience', 'audiences', 'addressees'])('preserves plural %s with stable deduplication', (key) => {
    expect(read({ [key]: ['Sofia', 'Mark', 'Sofia', null, ''] })).toMatchObject({ listeners: ['Sofia', 'Mark'], listenerProvenance: explicit })
    expect(read({ [key]: ['Sofia'] })).toMatchObject({ listener: 'Sofia' })
    expect(read({ [key]: ['Sofia', 'Mark'] })?.listenerId).toBeUndefined()
  })

  it.each([null, undefined, '', '  ', [], {}])('does not produce context from empty receiver %j', (value) => {
    const context = read({ receiver: value })
    expect(context?.listener).toBeUndefined()
    expect(context?.listeners).toBeUndefined()
    expect(context?.listenerProvenance).toBeUndefined()
  })

  it.each([false, { arbitrary: { name: 'Not a participant' } }, { isLosslessNumber: true, value: { nested: 'not a numeric ID' } }, [['Nested array']]])('does not stringify unsupported participant values %j', (value) => {
    expect(read({ receiver: value })?.listener).toBeUndefined()
  })

  it('reads only shallow role objects and keeps display names separate from IDs regardless of key order', () => {
    expect(read({ receiver: { displayName: 'Sofia', id: 42, gender: 'female' } })).toMatchObject({ listener: 'Sofia', listenerId: '42', listenerGender: 'female', listenerProvenance: explicit })
    for (const record of [
      { speaker_name: 'Sofia', speaker_id: 42, receiver_name: 'Mark', receiver_id: 'actor-2' },
      { receiver_id: 'actor-2', receiver_name: 'Mark', speaker_id: 42, speaker_name: 'Sofia' },
    ]) expect(read(record)).toMatchObject({ speaker: 'Sofia', speakerId: '42', listener: 'Mark', listenerId: 'actor-2' })
    expect(read({ unrelated: { name: 'Sofia', gender: 'female' } })?.speaker).toBeUndefined()
  })

  it('supports numeric identities without manufacturing IDs from names', () => {
    expect(read({ receiver: 0 })).toMatchObject({ listener: '0', listenerId: '0' })
    expect(read({ receiver: 'Sofia' })?.listenerId).toBeUndefined()
  })

  it('keeps per-participant genders in plural form', () => {
    expect(read({ receivers: [{ name: 'Sofia', id: 'a', gender: 'female' }, { name: 'Mark', id: 'b', gender: 'male' }] }))
      .toMatchObject({ listeners: ['Sofia', 'Mark'], listenerGenders: ['female', 'male'] })
    expect(read({ receivers: ['Sofia', 'Mark'], receiver_gender: ['female', 'male'] }))
      .toMatchObject({ listeners: ['Sofia', 'Mark'], listenerGenders: ['female', 'male'] })
    expect(read({ receiver: 'Sofia', receiver_gender: 'unknown' })).toMatchObject({ listenerGender: 'unknown' })
    expect(read({ receiver: 'Sofia' })?.listenerGender).toBeUndefined()
  })

  it('does not collapse different stable identities that share a display name', () => {
    const context = read({ receivers: [{ name: 'Alex', id: 'a', gender: 'female' }, { name: 'Alex', id: 'b', gender: 'male' }] })
    expect(context).toMatchObject({ listeners: ['Alex', 'Alex'], listenerGenders: ['female', 'male'] })
    expect(context?.listener).toBeUndefined()
    expect(context?.listenerId).toBeUndefined()
  })
})

describe('false positives and source-schema compatibility', () => {
  it.each(['total', 'token', 'button', 'targetingMode', 'targetValue', 'source', 'sourceFile', 'sourceText', 'senderColor', 'characterCount', 'audienceVolume', 'speakerVolume', 'recipientCount', 'toString', 'constructor', 'actorAnimation', 'receiverEnabled'])('does not interpret %s as a participant', (key) => {
    expect(recognizeContextField(key)).toBeUndefined()
    expect(detectContextFields([{ [key]: 'Sofia' }])).toEqual([])
    for (const { read } of readers) {
      expect(read({ [key]: 'Sofia' })?.speaker).toBeUndefined()
      expect(read({ [key]: 'Sofia' })?.listener).toBeUndefined()
    }
  })

  it('honors manual role and ignore mappings over built-in defaults', () => {
    for (const record of [{ talkingPotato: 'Manual', receiver: 'Built in' }, { receiver: 'Built in', talkingPotato: 'Manual' }]) {
      expect(inferContextFromRecord(record, [{ fieldName: 'talkingPotato', role: 'listener' }]).context).toMatchObject({ listener: 'Manual', listenerProvenance: { source: 'user-mapped', confidence: 'high' } })
      expect(detectDialogueContext(record, undefined, [{ field: 'talkingPotato', role: 'listener' }])).toMatchObject({ listener: 'Manual' })
    }
    expect(detectDialogueContext({ receiver: 'Sofia' }, undefined, [{ field: 'receiver', role: 'speaker' }])).toMatchObject({ speaker: 'Sofia' })
    expect(inferContextFromRecord({ receiver: 'Sofia' }, [{ fieldName: 'receiver', role: 'ignore' }]).context.listener).toBeUndefined()
  })

  it('normalizes the supplied schema in the shared parser used by Desktop and Web', () => {
    const record = { source: 'rdvt', chapter: '1', scene: '1a/$.inkb', entry_id: '1', speaker: 'Sofia', speaker_gender: 'female', receiver: 'KuyaGrab', receiver_gender: 'male', text_en: 'Hello!', text_ar: '', type: 'dialogue' }
    const expected = { speaker: 'Sofia', speakerGender: 'female', listener: 'KuyaGrab', listenerGender: 'male', scene: '1a/$.inkb', listenerProvenance: explicit }
    expect(inferContextFromRecord(record).context).toMatchObject(expected)
    const parsed = parseLocalizationFile(JSON.stringify([record]), 'synthetic.json')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.document.entries[0].dialogueContext).toMatchObject(expected)
    expect(parsed.document.entries[0].source).toBe('Hello!')
  })

  it('does not extract participant objects as extra translatable rows', () => {
    const result = extractGodot({ fileName: 'synthetic.json', text: JSON.stringify({ lines: [{ speaker: 'Mark', receiver: { name: 'Sofia', id: 'a', gender: 'female' }, text: 'Synthetic greeting.' }] }) })
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].context).toMatchObject({ listener: 'Sofia', listenerId: 'a', listenerGender: 'female' })
  })

  it('preserves numeric JSON identities, including lossless large IDs and object IDs', () => {
    const parsed = parseLocalizationFile('[{"text":"Hello!","speaker_id":9007199254740993,"receiver":{"name":"Sofia","id":42,"gender":1}}]', 'synthetic.json')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.document.entries[0].dialogueContext).toMatchObject({ speakerId: '9007199254740993', listener: 'Sofia', listenerId: '42', listenerGender: 'female' })
  })

  it('retains unrelated context aliases and honors mapped participant containers during extraction', () => {
    expect(inferContextFromRecord({ developer_note: 'Synthetic note', sex_code: 'F' }).context).toMatchObject({ developerNote: 'Synthetic note', speakerGender: 'female' })
    const result = extractGodot({ fileName: 'synthetic.json', mappings: [{ fieldName: 'talkingPotato', role: 'listener' }], text: JSON.stringify({ lines: [{ text: 'Hello!', talkingPotato: { name: 'Sofia', id: 'a' } }] }) })
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].context).toMatchObject({ listener: 'Sofia', listenerId: 'a' })
  })

  it.each([
    { file: 'synthetic.csv', text: 'id,Sender,Actor-Gender,Receiver Name,RECEIVER_GENDER,text\n1,Sofia,female,KuyaGrab,male,Hello!' },
    { file: 'synthetic.po', text: '# Sender: Sofia\n#. Actor-Gender: female\n#. Receiver Name: KuyaGrab\n#. RECEIVER_GENDER: male\nmsgid "Hello!"\nmsgstr ""' },
  ])('uses the same role detection in $file', ({ file, text }) => {
    const parsed = parseLocalizationFile(text, file)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.document.entries[0].dialogueContext).toMatchObject({ speaker: 'Sofia', speakerGender: 'female', listener: 'KuyaGrab', listenerGender: 'male', listenerProvenance: explicit })
  })
})
