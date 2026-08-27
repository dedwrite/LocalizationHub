import { describe, expect, it } from 'vitest'
import { readLocres } from './engines/locres'
import { readLocmeta } from './engines/locmeta'
import { aggregateCultures, applyNativeCulture, overrideSourceCulture } from './cultureAggregation'
import { scanGame, type ScanFile } from './scanGame'
import { buildProjectFromExtraction } from './projectFromExtraction'
import { extractUnrealTokens } from '../tokens/unreal'
import { buildCompactLocres } from './locres.fixtures'
import type { ExtractionResult } from './types'

describe('culture aggregation', () => {
  it('collapses the same namespace/key across cultures into one entry with locale variants', () => {
    const en = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'PLAY', localized: 'Play' }] }]), { containerPath: 'Game/Content/Localization/Game/en/Game.locres' })
    const fr = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'PLAY', localized: 'Jouer' }] }]), { containerPath: 'Game/Content/Localization/Game/fr/Game.locres' })
    const de = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'PLAY', localized: 'Spielen' }] }]), { containerPath: 'Game/Content/Localization/Game/de/Game.locres' })

    const { entries, targets } = aggregateCultures([...en.entries, ...fr.entries, ...de.entries])

    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('PLAY')
    // Without native-culture metadata, the alphabetically-first culture (de) is
    // the source; the others are locale variants.
    expect(entries[0].sourceText).toBe('Spielen')
    expect(entries[0].localeVariants?.map((v) => v.locale).sort()).toEqual(['en', 'fr'])
    expect(targets).toHaveLength(1)
    expect(targets[0].name).toBe('Game')
    expect(targets[0].availableCultures.sort()).toEqual(['de', 'en', 'fr'])
  })

  it('uses LOCMETA native culture to set the source text', () => {
    const fr = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'PLAY', localized: 'Jouer' }] }]), { containerPath: 'Game/Content/Localization/Game/fr/Game.locres' })
    const en = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'PLAY', localized: 'Play' }] }]), { containerPath: 'Game/Content/Localization/Game/en/Game.locres' })

    // Without native-culture metadata, en sorts first alphabetically → source.
    const { entries } = aggregateCultures([...fr.entries, ...en.entries])
    expect(entries[0].sourceText).toBe('Play')

    // With native culture = fr, fr becomes the source even though en sorts first.
    const withNative = applyNativeCulture({ entries, targets: [] }, new Map([['Game', 'fr']]))
    expect(withNative.entries[0].sourceText).toBe('Jouer')
    expect(withNative.entries[0].sourceLocale).toBe('fr')
    // en (the old source) is preserved as the remaining locale variant.
    expect(withNative.entries[0].localeVariants?.map((v) => v.locale)).toEqual(['en'])
  })
})

describe('LOCRES protected tokens + classification', () => {
  it('runs the Unreal token profile against localized text', () => {
    const buffer = buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'COUNT', localized: 'You have {Count}|plural(one=item,other=items).' }] }])
    const result = readLocres(buffer, { containerPath: 'Game/Content/Localization/Game/en/Game.locres' })
    expect(result.entries[0].protectedSegments.length).toBeGreaterThan(0)
    expect(result.entries[0].protectedSegments.some((s) => s.raw.includes('plural'))).toBe(true)
  })

  it('classifies dialogue namespaces as Dialogue, not UI', () => {
    const buffer = buildCompactLocres([{ namespace: 'Dialogue', keys: [{ key: 'Line_01', localized: 'Where have you been?' }] }])
    const result = readLocres(buffer, { containerPath: 'Game/Content/Localization/Game/en/Game.locres' })
    expect(result.entries[0].classification).toBe('Dialogue')
  })
})

describe('source culture override', () => {
  it('switches each entry sourceText to the selected culture, preserving the others as variants', () => {
    const en = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'PLAY', localized: 'Play' }, { key: 'QUIT', localized: 'Quit' }] }]), { containerPath: 'Game/Content/Localization/Game/en/Game.locres' })
    const fr = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'PLAY', localized: 'Jouer' }, { key: 'QUIT', localized: 'Quitter' }] }]), { containerPath: 'Game/Content/Localization/Game/fr/Game.locres' })
    const { entries } = aggregateCultures([...en.entries, ...fr.entries])

    // Default: en is source.
    expect(entries.find((e) => e.key === 'PLAY')?.sourceText).toBe('Play')

    // Override to fr: PLAY becomes "Jouer", QUIT becomes "Quitter".
    const overridden = overrideSourceCulture(entries, 'fr')
    expect(overridden.find((e) => e.key === 'PLAY')?.sourceText).toBe('Jouer')
    expect(overridden.find((e) => e.key === 'PLAY')?.sourceLocale).toBe('fr')
    expect(overridden.find((e) => e.key === 'QUIT')?.sourceText).toBe('Quitter')
    // en is now preserved as a variant.
    expect(overridden.find((e) => e.key === 'PLAY')?.localeVariants?.map((v) => v.locale)).toEqual(['en'])
  })
})

describe('stable global IDs', () => {
  it('produces distinct IDs for the same key in two different StringTables', () => {
    const t1 = buildCompactLocres([{ namespace: 'TableA', keys: [{ key: 'PLAY', localized: 'Play' }] }])
    const t2 = buildCompactLocres([{ namespace: 'TableB', keys: [{ key: 'PLAY', localized: 'Play' }] }])
    const r1 = readLocres(t1, { containerPath: 'Game/Content/Localization/Game/en/Game.locres' })
    const r2 = readLocres(t2, { containerPath: 'Game/Content/Localization/Game/en/Game.locres' })
    // Different namespaces → different IDs.
    expect(r1.entries[0].id).not.toBe(r2.entries[0].id)
  })
})

describe('privacy', () => {
  it('never serializes absolute paths, usernames, or temp dirs into project metadata', () => {
    const result: ExtractionResult = {
      engine: 'godot',
      detection: { engine: 'godot', familyLabel: 'Godot', confidence: 'high', evidence: ['project.godot'] },
      entries: [{
        id: 'dialogue:0:text',
        key: 'line_0',
        order: 0,
        sourceText: 'Hello',
        classification: 'Dialogue',
        classificationConfidence: 'high',
        context: { speaker: 'Mira' },
        origin: { engine: 'godot', containerPath: 'Data/dialogue.json', fieldPath: '0.text' },
        protectedSegments: [],
        protectionProfile: 'godot',
      }],
      diagnostics: [],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 1, byClassification: { Dialogue: 1 }, protectedTokenCount: 0, entriesWithSpeaker: 1, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 1, conversationGroups: 0, warnings: 0, errors: 0 },
    }
    const project = buildProjectFromExtraction(result, 'game.extracted')
    const json = JSON.stringify(project)

    expect(json).not.toContain('C:\\')
    expect(json).not.toContain('C:/')
    expect(json).not.toContain('TestPerson')
    expect(json).not.toContain('AppData')
    expect(json).not.toContain('Users\\')
  })
})

describe('scanGame path separation', () => {
  it('reads by absolutePath but stores relativePath as provenance', async () => {
    const files: ScanFile[] = [{
      name: 'dialogue.json',
      relativePath: 'Data/dialogue.json',
      absolutePath: 'C:/Users/TestPerson/Game/Data/dialogue.json',
      size: 10,
    }]
    const reader = {
      readText: async (file: ScanFile) => {
        // Prove the reader received the absolute path.
        expect(file.absolutePath).toContain('C:/Users/TestPerson')
        return JSON.stringify([{ speaker: 'Mira', text: 'Hello' }])
      },
      readBinary: async () => new Uint8Array(),
    }
    const result = await scanGame({ files, reader })
    expect(result.entries[0].origin.containerPath).toBe('Data/dialogue.json')
    expect(result.entries[0].origin.containerPath).not.toContain('TestPerson')
    expect(result.entries[0].origin.containerPath).not.toContain('C:')
  })
})
