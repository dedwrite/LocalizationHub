/*
 * Generic context round-trip test.
 *
 * Proves the new `dialogueContext` survives a Project V3 encode → decode cycle
 * (JSON.stringify → decodeLocalizationProject), so it round-trips through
 * save/cloud/web exactly like any other entry field. No schema bump needed —
 * `dialogueContext` is a plain, serializable field on `ParsedLocalizationEntry`.
 */

import { describe, expect, it } from 'vitest'
import { parseLocalizationFile } from './index'
import { decodeLocalizationProject, type LocalizationProjectV3 } from '../projectModel'

function buildProjectV3(text: string, fileName: string): LocalizationProjectV3 {
  const result = parseLocalizationFile(text, fileName)
  if (!result.ok) throw new Error(result.reason)
  return {
    format: 'LocalizationHubProject',
    version: 3,
    sourceFileName: fileName,
    selectedEntryId: result.document.entries[0]?.id ?? null,
    tokenProfile: 'generic',
    document: {
      parser: result.document.parser,
      format: result.document.format,
      sourceText: text,
      schema: result.document.schema,
      language: result.document.language,
    },
    entries: result.document.entries,
    workflow: { entries: {} },
  }
}

describe('dialogue context round-trip', () => {
  it('preserves speaker/listener IDs, genders, pronouns, scene, conversation, node/line, voice, portrait', () => {
    const text = JSON.stringify([
      {
        id: '001',
        speaker_id: 'mark',
        speaker: 'Mark',
        speaker_gender: 'male',
        speaker_pronouns: 'he/him',
        listener_id: 'cathy',
        listener: 'Cathy',
        listener_gender: 'female',
        listener_pronouns: 'she/her',
        listeners: ['Cathy', 'Ryan'],
        scene: 'School Hallway',
        conversation_id: 'conv-1',
        line_id: 'line-42',
        voice: 'vo_mark_01',
        portrait: 'port_mark',
        text: 'Where are you going?',
      },
    ])
    const project = buildProjectV3(text, 'dialogue.json')
    const encoded = JSON.stringify(project)
    const decoded = decodeLocalizationProject(encoded)

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    const [entry] = decoded.project.entries
    const ctx = entry.dialogueContext
    expect(ctx?.speaker).toBe('Mark')
    expect(ctx?.speakerId).toBe('mark')
    expect(ctx?.speakerGender).toBe('male')
    expect(ctx?.speakerPronouns).toBe('he/him')
    expect(ctx?.listener).toBe('Cathy')
    expect(ctx?.listenerId).toBe('cathy')
    expect(ctx?.listenerGender).toBe('female')
    expect(ctx?.listenerPronouns).toBe('she/her')
    expect(ctx?.listeners).toEqual(['Cathy', 'Ryan'])
    expect(ctx?.scene).toBe('School Hallway')
    expect(ctx?.conversationId).toBe('conv-1')
    expect(ctx?.dialogueId).toBe('line-42')
    expect(ctx?.voice).toBe('vo_mark_01')
    expect(ctx?.portrait).toBe('port_mark')
  })

  it('round-trips CSV context', () => {
    const text = 'id,speaker,speaker_gender,listener,text\n001,Mark,male,Cathy,Hello'
    const project = buildProjectV3(text, 'dialogue.csv')
    const encoded = JSON.stringify(project)
    const decoded = decodeLocalizationProject(encoded)

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    const [entry] = decoded.project.entries
    expect(entry.dialogueContext?.speaker).toBe('Mark')
    expect(entry.dialogueContext?.speakerGender).toBe('male')
    expect(entry.dialogueContext?.listener).toBe('Cathy')
  })
})
