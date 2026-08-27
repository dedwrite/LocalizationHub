/*
 * v0.7 acceptance proofs (pure unit tests, no external tools required).
 *
 * These pin down the behaviors the acceptance criteria demand:
 *   - source-culture override preserves all variants and re-parses tokens
 *   - Ignore mapping produces no translation entry and no context
 *   - custom protected patterns flow into extraction AND QA detection
 *   - hostile regex is rejected / bounded (no catastrophic backtracking)
 *   - privacy: serialized projects never leak absolute paths / tool paths
 */

import { describe, expect, it } from 'vitest'
import { buildProjectFromExtraction } from './projectFromExtraction'
import { overrideSourceCulture, aggregateCultures } from './cultureAggregation'
import { extractUnity } from './engines/unity'
import { extractUnrealLocres } from './engines/unreal'
import { readLocres } from './engines/locres'
import { buildCompactLocres } from './locres.fixtures'
import {
  createCustomTokenProfile,
  setCustomTokenProfile,
  validateProtectedTokens,
  validateCustomPattern,
  previewCustomPattern,
} from '../tokens'

describe('source culture override (real proof)', () => {
  it('switches source to fr, keeps en/de as variants, and re-parses tokens from the new source', () => {
    const en = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'GREET', localized: 'Hello {0}' }] }]), { containerPath: 'Game/Localization/Game/en/Game.locres' })
    const fr = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'GREET', localized: 'Bonjour {0}' }] }]), { containerPath: 'Game/Localization/Game/fr/Game.locres' })
    const de = readLocres(buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'GREET', localized: 'Hallo {0}' }] }]), { containerPath: 'Game/Localization/Game/de/Game.locres' })

    const { entries } = aggregateCultures([...en.entries, ...fr.entries, ...de.entries])
    expect(entries[0].sourceText).toBe('Hallo {0}') // de sorts first without native culture

    const overridden = overrideSourceCulture(entries, 'fr')
    expect(overridden[0].sourceText).toBe('Bonjour {0}')
    expect(overridden[0].sourceLocale).toBe('fr')
    // en and de are preserved as variants.
    expect(overridden[0].localeVariants?.map((v) => v.locale).sort()).toEqual(['de', 'en'])

    // Protected tokens are re-computed from the NEW source text ("Bonjour {0}").
    expect(overridden[0].protectedSegments.some((s) => s.raw === '{0}')).toBe(true)
  })
})

describe('Ignore mapping (real proof)', () => {
  it('maps debug_id to Ignore: no entry and no context, but keeps speaker + text', () => {
    const result = extractUnity(
      {
        fileName: 'dialogue.json',
        text: JSON.stringify({ who: 'Mira', debug_id: 'DLG_1928_INTERNAL', msg: 'Come with me.' }),
        mappings: [
          { fieldName: 'who', role: 'speaker' },
          { fieldName: 'debug_id', role: 'ignore' },
          { fieldName: 'msg', role: 'translatableText' },
        ],
      },
    )

    // One translatable entry (msg), not two.
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].sourceText).toBe('Come with me.')
    expect(result.entries[0].context?.speaker).toBe('Mira')
    // debug_id must never surface as text or context.
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('DLG_1928_INTERNAL')
  })
})

describe('custom protected patterns in extraction + QA (real proof)', () => {
  it('carries custom tokens onto extracted entries and detects them in QA', () => {
    const profile = createCustomTokenProfile([
      { id: 'player', label: 'Player', pattern: '@\\w+@' },
      { id: 'item', label: 'Item', pattern: '\\[\\w+\\]' },
    ])
    setCustomTokenProfile(profile)

    try {
      const result = extractUnity({
        fileName: 'line.json',
        text: JSON.stringify({ text: 'Hello @PLAYER@, take [ITEM_SWORD].' }),
      })

      const entry = result.entries[0]
      const raws = entry.protectedSegments.map((s) => s.raw)
      expect(raws).toContain('@PLAYER@')
      expect(raws).toContain('[ITEM_SWORD]')

      // QA: removing a custom token must be flagged.
      const qa = validateProtectedTokens(
        'Hello @PLAYER@, take [ITEM_SWORD].',
        'مرحبا، خذ السيف.',
        'custom',
      )
      expect(qa.hasErrors).toBe(true)
      expect(qa.missingTokens.map((t) => t.raw)).toEqual(expect.arrayContaining(['@PLAYER@', '[ITEM_SWORD]']))
    } finally {
      setCustomTokenProfile(undefined)
    }
  })
})

describe('custom regex safety (real proof)', () => {
  it('rejects empty, overlong, and nested-quantifier patterns', () => {
    expect(validateCustomPattern('   ').valid).toBe(false)
    expect(validateCustomPattern('a'.repeat(600)).valid).toBe(false)
    expect(validateCustomPattern('(a+)+$').valid).toBe(false)
    expect(validateCustomPattern('([a-z]+)*').valid).toBe(false)
  })

  it('bounds preview output', () => {
    const preview = previewCustomPattern('\\w+', 'word '.repeat(5000))
    expect(preview.valid).toBe(true)
    expect(preview.matches.length).toBeLessThanOrEqual(200)
  })
})

describe('privacy: no leaked absolute paths (real proof)', () => {
  it('serializes an extracted project with only logical paths', () => {
    const result = extractUnrealLocres({
      fileName: 'Game/Content/Localization/Game/en/Game.locres',
      buffer: buildCompactLocres([{ namespace: 'Game', keys: [{ key: 'PLAY', localized: 'Play' }] }]),
    })
    const project = buildProjectFromExtraction(
      result,
      'extracted-game.json',
      new Set(result.entries.map((e) => e.id)),
    )
    const serialized = JSON.stringify(project)

    for (const banned of ['E:\\all tools for loc', 'C:\\', 'AppData', '\\Users\\', 'repak.exe', 'retoc.exe', 'gdre_tools.exe', 'UnityPy', 'UAssetDumper']) {
      expect(serialized).not.toContain(banned)
    }
  })
})
