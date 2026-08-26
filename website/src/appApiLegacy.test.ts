import { describe, expect, it } from 'vitest'
import { decodeCloudProject } from './appApi'

const snapshot = {
  id: 'proj-1',
  name: 'Legacy Game',
  role: 'owner' as const,
  revision: 7,
  updatedAt: '2026-08-26T00:00:00Z',
}

describe('decodeCloudProject legacy migration', () => {
  it('passes through a valid Project V3 unchanged', () => {
    const v3 = {
      format: 'LocalizationHubProject',
      version: 3,
      sourceFileName: 'game.json',
      selectedEntryId: 'e0',
      tokenProfile: 'generic',
      document: { parser: 'json', format: 'flat-json-object', sourceText: '{}', language: { sourceDirection: 'ltr', translationDirection: 'ltr' } },
      entries: [{ id: 'e0', key: 'menu.start', source: 'Start', translation: '', keyPath: ['menu.start'], sourcePath: ['menu.start'] }],
      workflow: { entries: { e0: { status: 'draft' } } },
    }
    const result = decodeCloudProject({ ...snapshot, project: v3 })
    expect(result.project.version).toBe(3)
    expect(result.migratedFromVersion).toBeNull()
    expect(result.id).toBe('proj-1')
    expect(result.revision).toBe(7)
  })

  it('migrates a Project V2 to V3', () => {
    const v2 = {
      format: 'LocalizationHubProject',
      version: 2,
      sourceFileName: 'game.json',
      selectedEntryId: 'e0',
      tokenProfile: 'godot',
      document: { parser: 'json', format: 'flat-json-object', sourceText: '{}', language: { sourceDirection: 'ltr', translationDirection: 'ltr' } },
      entries: [{ id: 'e0', key: 'menu.start', source: 'Start', translation: 'Start', keyPath: ['menu.start'], sourcePath: ['menu.start'] }],
    }
    const result = decodeCloudProject({ ...snapshot, project: v2 })
    expect(result.project.version).toBe(3)
    expect(result.migratedFromVersion).toBe(2)
    expect(result.project.workflow.entries).toEqual({})
    expect(result.project.entries).toHaveLength(1)
    expect(result.project.entries[0].key).toBe('menu.start')
  })

  it('migrates a Project V1 to V3 preserving entries', () => {
    const v1 = {
      format: 'LocalizationHubProject',
      version: 1,
      sourceFileName: 'game.json',
      selectedKey: 'menu.quit',
      tokenProfile: 'generic',
      entries: [
        { key: 'menu.start', source: 'Start', translation: 'Start' },
        { key: 'menu.quit', source: 'Quit', translation: 'Quitter' },
      ],
    }
    const result = decodeCloudProject({ ...snapshot, project: v1 })
    expect(result.project.version).toBe(3)
    expect(result.migratedFromVersion).toBe(1)
    expect(result.project.entries).toHaveLength(2)
    // Entry IDs must remain stable (deterministic from legacy index + key).
    expect(result.project.entries[0].id).toBe('legacy:0:menu.start')
    expect(result.project.entries[1].id).toBe('legacy:1:menu.quit')
    // selectedKey maps to the restored entry id.
    expect(result.project.selectedEntryId).toBe('legacy:1:menu.quit')
  })

  it('rejects a corrupt project with a useful error and no write', () => {
    expect(() => decodeCloudProject({ ...snapshot, project: { format: 'NotAProject' } })).toThrow(/cannot be opened/)
  })
})
