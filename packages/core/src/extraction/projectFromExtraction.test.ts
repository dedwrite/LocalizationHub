import { describe, expect, it } from 'vitest'
import { buildProjectFromExtraction } from './projectFromExtraction'
import { extractGodot } from './engines/godot'

describe('projectFromExtraction', () => {
  it('converts extracted entries into a V3 project with extraction metadata', () => {
    const result = extractGodot({
      fileName: 'dialogue.json',
      text: JSON.stringify([{ speaker: 'Mira', text: 'Where have you been?', speakerGender: 'female' }]),
    })

    const project = buildProjectFromExtraction(result, 'game.extracted')

    expect(project.version).toBe(3)
    expect(project.format).toBe('LocalizationHubProject')
    expect(project.entries).toHaveLength(1)
    expect(project.entries[0].source).toBe('Where have you been?')
    expect(project.tokenProfile).toBe('auto')
    expect(project.tokenProfileConfig?.mode).toBe('auto')
    expect(project.tokenProfileConfig?.resolvedProfile).toBe('godot')

    // Backward-compatible extraction metadata.
    const extraction = project.metadata?.extraction
    expect(extraction).toBeDefined()
    expect(extraction?.engine).toBe('godot')
    const entryId = project.entries[0].id
    expect(extraction?.entries[entryId]?.context?.speaker).toBe('Mira')
    expect(extraction?.entries[entryId]?.context?.speakerGender).toBe('female')
  })

  it('preserves entry identity (id, key) distinct from source text', () => {
    const result = extractGodot({
      fileName: 'game.csv',
      text: 'keys,en\ngreeting,Open\nmenu_quit,Open\n',
    })
    const project = buildProjectFromExtraction(result, 'game.extracted')
    // Two distinct entries with identical source text "Open".
    expect(project.entries).toHaveLength(2)
    expect(project.entries[0].key).toBe('greeting')
    expect(project.entries[1].key).toBe('menu_quit')
    expect(project.entries[0].id).not.toBe(project.entries[1].id)
  })

  it('honors the included-entry filter (100 extracted, 25 excluded → 75 in project)', () => {
    // Build a synthetic 100-entry result.
    const text = JSON.stringify(
      Array.from({ length: 100 }, (_, i) => ({ speaker: 'A', text: `Line ${i}` })),
    )
    const result = extractGodot({ fileName: 'dialogue.json', text })
    expect(result.entries).toHaveLength(100)

    // Exclude 25 entries (the first 25).
    const excluded = new Set(result.entries.slice(0, 25).map((e) => e.id))
    const included = new Set(result.entries.filter((e) => !excluded.has(e.id)).map((e) => e.id))

    const project = buildProjectFromExtraction(result, 'game.extracted', included)
    expect(project.entries).toHaveLength(75)
    expect(project.metadata?.extraction?.entries).not.toBeUndefined()
    expect(Object.keys(project.metadata?.extraction?.entries ?? {})).toHaveLength(75)
  })
})
