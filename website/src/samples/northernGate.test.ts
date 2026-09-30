import { describe, expect, it } from 'vitest'
import { decodeLocalizationProject, validateProtectedTokens } from '@localizationhub/core'
import { createNorthernGateSample } from './northernGate'
import { exportLocalProject } from '../localProjects'
import { buildEntryCollection } from '../workspace/entryCollection'

describe('Northern Gate product tour', () => {
  it('contains 24 native, independently editable entries with real dialogue context', () => {
    const project = createNorthernGateSample()
    expect(decodeLocalizationProject(JSON.stringify(project)).ok).toBe(true)
    expect(project.entries).toHaveLength(24)
    expect(project.entries[0].dialogueContext).toMatchObject({ speaker: 'Captain Veyra', listener: 'Player', scene: 'Northern Gate' })
    expect(project.document.language).toMatchObject({ sourceLocale: 'en', translationLocale: 'ar', translationDirection: 'rtl' })
    project.entries[0].translation = 'edited'
    expect(createNorthernGateSample().entries[0].translation).not.toBe('edited')
  })
  it('ships exactly one deliberate token error, with glossary, memory, and review states', () => {
    const project = createNorthernGateSample()
    const bad = project.entries.filter(entry => entry.translation && validateProtectedTokens(entry.source, entry.translation, 'generic').hasErrors)
    expect(bad.map(entry => entry.key)).toEqual(['quest.gate.reward'])
    expect(project.metadata?.glossary).toHaveLength(2)
    expect(project.metadata?.translationMemory).toHaveLength(1)
    expect(project.metadata?.comments).toHaveLength(1)
    const taggedEntryIds = new Set(Object.keys(project.metadata!.entryTags))
    const collection = buildEntryCollection({ entries: project.entries, workflow: project.workflow.entries, filter: 'tags', query: '', taggedEntryIds })
    expect(collection.counts).toMatchObject({ tags: 24, errors: 1, approved: 4, 'needs-review': 2, untranslated: 3 })
    expect(collection.views).toHaveLength(24)
  })
  it('exports edits without stripping source records, listeners or protected syntax', () => {
    const project = createNorthernGateSample()
    project.entries[0].translation = 'Test {player_name} <color=#A86BFF>Gate</color>'
    const exported = JSON.parse(exportLocalProject(project))
    expect(exported[0]).toMatchObject({ receiver: 'Player', speaker: 'Captain Veyra', translation: project.entries[0].translation, source: project.entries[0].source })
    expect(exported).toHaveLength(24)
  })
})
