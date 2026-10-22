import { describe, expect, it } from 'vitest'
import { decodeLocalizationProject, validateProtectedTokens } from '@localizationhub/core'
import { createLastBroadcastSample } from './lastBroadcast'
import { exportLocalProject } from '../localProjects'
import { buildEntryCollection } from '../workspace/entryCollection'

describe('Last Broadcast product tour', () => {
  it('contains 24 native, independently editable entries with real dialogue context', () => {
    const project = createLastBroadcastSample()
    expect(decodeLocalizationProject(JSON.stringify(project)).ok).toBe(true)
    expect(project.entries).toHaveLength(24)
    expect(project.entries[0].dialogueContext).toMatchObject({ speaker: 'Engineer Mira', listener: 'Player', scene: 'Relay Station' })
    expect(project.document.language).toMatchObject({ sourceLocale: 'en', translationLocale: 'ar', translationDirection: 'rtl' })
    project.entries[0].translation = 'edited'
    expect(createLastBroadcastSample().entries[0].translation).not.toBe('edited')
  })
  it('ships exactly one deliberate token error, with glossary, memory, and review states', () => {
    const project = createLastBroadcastSample()
    const bad = project.entries.filter(entry => entry.translation && validateProtectedTokens(entry.source, entry.translation, 'generic').hasErrors)
    expect(bad.map(entry => entry.key)).toEqual(['quest.broadcast.reward'])
    expect(project.metadata?.glossary).toHaveLength(2)
    expect(project.metadata?.translationMemory).toHaveLength(1)
    expect(project.metadata?.comments).toHaveLength(1)
    const taggedEntryIds = new Set(Object.keys(project.metadata!.entryTags))
    const collection = buildEntryCollection({ entries: project.entries, workflow: project.workflow.entries, filter: 'tags', query: '', taggedEntryIds })
    expect(collection.counts).toMatchObject({ tags: 24, errors: 1, approved: 4, 'needs-review': 2, untranslated: 3 })
    expect(collection.views).toHaveLength(24)
  })
  it('exports edits without stripping source records, listeners or protected syntax', () => {
    const project = createLastBroadcastSample()
    project.entries[0].translation = 'Test {player_name}'
    const exported = JSON.parse(exportLocalProject(project))
    expect(exported[0]).toMatchObject({ receiver: 'Player', speaker: 'Engineer Mira', translation: project.entries[0].translation, source: project.entries[0].source })
    expect(exported).toHaveLength(24)
  })
})
