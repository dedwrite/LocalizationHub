import { describe, expect, it } from 'vitest'
import { classifyString } from './classification'
import { inferContextFromRecord, normalizeGender, recognizeContextField } from './contextInference'
import { groupByConversationId, linkConversationOrder } from './conversationInference'
import { analyzeRecord, structuralEntryId } from './structuredData'
import { detectEngine } from './engineDetection'

describe('classification', () => {
  it('classifies natural-language sentences as translatable', () => {
    const decision = classifyString('Where have you been all this time?', { dialogueSchema: true })
    expect(decision.translatable).toBe(true)
    expect(decision.classification).toBe('Dialogue')
  })

  it('classifies a GUID as non-translatable', () => {
    const decision = classifyString('12345678-1234-1234-1234-123456789012')
    expect(decision.translatable).toBe(false)
    expect(decision.reasons).toContain('is-guid')
  })

  it('classifies a hash as non-translatable', () => {
    const decision = classifyString('a1b2c3d4e5f6a7b8c9d0e1f2')
    expect(decision.translatable).toBe(false)
    expect(decision.reasons).toContain('is-hash')
  })

  it('classifies a Godot res:// path as non-translatable', () => {
    const decision = classifyString('res://scenes/level1.tscn')
    expect(decision.translatable).toBe(false)
    expect(decision.reasons).toContain('is-resource-reference')
  })

  it('classifies a bare identifier as non-translatable', () => {
    const decision = classifyString('player_health')
    expect(decision.translatable).toBe(false)
    expect(decision.reasons).toContain('is-identifier')
  })

  it('classifies an enum-like constant as non-translatable', () => {
    const decision = classifyString('ITEM_SWORD')
    expect(decision.translatable).toBe(false)
    expect(decision.reasons).toContain('is-enum')
  })

  it('classifies UI component text', () => {
    const decision = classifyString('Settings', { uiComponentField: true })
    expect(decision.translatable).toBe(true)
    expect(decision.classification).toBe('UI')
  })
})

describe('context inference', () => {
  it('recognizes speaker / listener / gender field aliases', () => {
    expect(recognizeContextField('speaker_id')).toBe('speaker')
    expect(recognizeContextField('target_actor')).toBe('listener')
    expect(recognizeContextField('sex_code')).toBe('speakerGender')
    expect(recognizeContextField('text')).toBe('translatableText')
    expect(recognizeContextField('assetGuid')).toBeUndefined()
  })

  it('infers context from a structured record', () => {
    const record = {
      speaker: 'Mira',
      listener: 'Player',
      speakerGender: 'female',
      text: 'Where have you been?',
      scene: 'chapter3',
    }
    const { context, translatableFields } = inferContextFromRecord(record)
    expect(context.speaker).toBe('Mira')
    expect(context.listener).toBe('Player')
    expect(context.speakerGender).toBe('female')
    expect(context.scene).toBe('chapter3')
    expect(translatableFields).toHaveLength(1)
    expect(translatableFields[0].field).toBe('text')
  })

  it('supports user-defined field mappings for custom schemas', () => {
    const record = { who: 'Ada', target_actor: 'NPC', sex_code: 'f', line: 'Hello.' }
    const { context } = inferContextFromRecord(record, [
      { fieldName: 'who', role: 'speaker' },
      { fieldName: 'target_actor', role: 'listener' },
      { fieldName: 'sex_code', role: 'speakerGender' },
      { fieldName: 'line', role: 'translatableText' },
    ])
    expect(context.speaker).toBe('Ada')
    expect(context.listener).toBe('NPC')
    expect(context.speakerGender).toBe('female')
  })

  it('normalizes gender values without inventing from names', () => {
    expect(normalizeGender('female')).toBe('female')
    expect(normalizeGender('f')).toBe('female')
    expect(normalizeGender('M')).toBe('male')
    expect(normalizeGender(1)).toBe('female')
    expect(normalizeGender('Mira')).toBe('custom')
    expect(normalizeGender(undefined)).toBe('unknown')
  })

  it('does not infer gender from a person name alone', () => {
    const record = { speaker: 'Mira', text: 'Hello.' }
    const { context } = inferContextFromRecord(record)
    expect(context.speakerGender).toBeUndefined()
  })
})

describe('conversation inference', () => {
  it('groups entries sharing a conversation ID', () => {
    const entries = [
      { id: 'a', context: { conversationId: 'c1' } },
      { id: 'b', context: { conversationId: 'c1' } },
      { id: 'c', context: { conversationId: 'c2' } },
    ]
    const groups = groupByConversationId(entries)
    expect(groups).toHaveLength(1)
    expect(groups[0].entryIds).toEqual(['a', 'b'])
  })

  it('links previous/next within a conversation in source order', () => {
    const entries = [
      { id: 'a', order: 0, context: { conversationId: 'c1' } },
      { id: 'b', order: 1, context: { conversationId: 'c1' } },
      { id: 'c', order: 2, context: { conversationId: 'c1' } },
    ]
    linkConversationOrder(entries)
    expect(entries[0].context?.nextEntryId).toBe('b')
    expect(entries[1].context?.previousEntryId).toBe('a')
    expect(entries[1].context?.nextEntryId).toBe('c')
    expect(entries[2].context?.previousEntryId).toBe('b')
  })
})

describe('structured data analysis', () => {
  it('produces ONE translatable entry for a record with context fields', () => {
    const record = {
      speaker: 'Mira',
      listener: 'Player',
      speakerGender: 'female',
      text: 'Where have you been?',
    }
    const { entries, context } = analyzeRecord(
      { record, path: ['dialogue', '0'], order: 0 },
      {
        engine: 'generic',
        protectionProfile: 'generic',
        extractProtectedSegments: () => [],
        forceTranslatableFields: ['text'],
        neverTranslatableFields: ['id'],
      },
    )
    expect(entries).toHaveLength(1)
    expect(entries[0].sourceText).toBe('Where have you been?')
    expect(entries[0].context?.speaker).toBe('Mira')
    expect(context.speaker).toBe('Mira')
  })

  it('handles multiple text fields in one record (choice + response + note)', () => {
    const record = {
      speaker: 'Mira',
      choice: 'Ask about the sword',
      response: 'I lost it.',
      note: 'Mira is lying',
    }
    const { entries } = analyzeRecord(
      { record, path: ['n'], order: 0 },
      {
        engine: 'generic',
        protectionProfile: 'generic',
        extractProtectedSegments: () => [],
        forceTranslatableFields: ['choice', 'response', 'note'],
      },
    )
    // choice + response are translatable; note is context/developer note.
    expect(entries.map((e) => e.sourceText)).toContain('Ask about the sword')
    expect(entries.map((e) => e.sourceText)).toContain('I lost it.')
  })

  it('does not produce entries for structural identifier fields', () => {
    const record = { id: 'npc-001', guid: '12345678-1234-1234-1234-123456789012', text: 'Hi' }
    const { entries } = analyzeRecord(
      { record, path: ['n'], order: 0 },
      {
        engine: 'generic',
        protectionProfile: 'generic',
        extractProtectedSegments: () => [],
        neverTranslatableFields: ['id', 'guid'],
      },
    )
    expect(entries.map((e) => e.sourceText)).toEqual(['Hi'])
  })

  it('structuralEntryId is stable and distinct for distinct paths', () => {
    expect(structuralEntryId(['dialogue', '0', 'text'])).toBe(structuralEntryId(['dialogue', '0', 'text']))
    expect(structuralEntryId(['dialogue', '0', 'text'])).not.toBe(structuralEntryId(['dialogue', '1', 'text']))
  })
})

describe('engine detection', () => {
  it('detects Unreal from pak/uasset files', () => {
    const detection = detectEngine({
      files: [
        { name: 'pakchunk0.pak', lower: 'pakchunk0.pak' },
        { name: 'Game.locres', lower: 'game.locres' },
      ],
      directories: [],
    })
    expect(detection.engine).toBe('unreal')
    expect(detection.confidence).toBe('high')
  })

  it('detects Godot from project.godot', () => {
    const detection = detectEngine({
      files: [{ name: 'project.godot', lower: 'project.godot' }],
      directories: [],
    })
    expect(detection.engine).toBe('godot')
  })

  it('detects Unity from *_Data directory + assets', () => {
    const detection = detectEngine({
      files: [
        { name: 'resources.assets', lower: 'resources.assets' },
        { name: 'globalgamemanagers', lower: 'globalgamemanagers' },
      ],
      directories: [{ name: 'MyGame_Data', lower: 'mygame_data' }],
    })
    expect(detection.engine).toBe('unity')
  })

  it('detects Unity HIGH-confidence from a realistic extensionless layout', () => {
    const detection = detectEngine({
      files: [
        { name: 'Game.exe', lower: 'game.exe' },
        { name: 'globalgamemanagers', lower: 'globalgamemanagers' },
        { name: 'resources.assets', lower: 'resources.assets' },
        { name: 'sharedassets0.assets', lower: 'sharedassets0.assets' },
        { name: 'level0', lower: 'level0' },
      ],
      directories: [
        { name: 'Game_Data', lower: 'game_data' },
        { name: 'Game_Data/StreamingAssets', lower: 'game_data/streamingassets' },
      ],
    })
    expect(detection.engine).toBe('unity')
    expect(detection.confidence).toBe('high')
  })

  it('returns low-confidence generic for unknown content', () => {
    const detection = detectEngine({ files: [{ name: 'readme.txt', lower: 'readme.txt' }], directories: [] })
    expect(detection.engine).toBe('generic')
    expect(detection.confidence).toBe('low')
  })
})
