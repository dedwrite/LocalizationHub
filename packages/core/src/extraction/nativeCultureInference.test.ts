/*
 * Source/native culture inference tests.
 *
 * Guards against the "source language = de because it sorts first" regression:
 * the native culture must be inferred from explicit base-content evidence
 * (`rawMetadata.isSourceLocale`), and when no evidence exists it must stay
 * unset (the UI then shows an explicit "Select…" state instead of defaulting
 * to the first locale alphabetically).
 */

import { describe, expect, it } from 'vitest'
import { inferNativeCultures } from './cultureAggregation'
import type { ExtractedEntry, LocalizationTarget } from './types'

function entry(sourceLocale: string, isSourceLocale: boolean, cultureIdentity: string): ExtractedEntry {
  return {
    id: `${cultureIdentity}:${sourceLocale}`,
    order: 0,
    sourceText: 'text',
    sourceLocale,
    classification: 'UI',
    classificationConfidence: 'high',
    origin: { engine: 'godot' },
    cultureIdentity,
    protectedSegments: [],
    protectionProfile: 'godot',
    rawMetadata: { isSourceLocale },
  }
}

describe('inferNativeCultures', () => {
  it('infers native culture from base-content evidence (not alphabetical)', () => {
    const targets: LocalizationTarget[] = [
      { name: 'godot-db:fb', availableCultures: ['de', 'en', 'ja'] },
    ]
    // Base (English) is marked source; de/ja are overlays.
    const entries = [
      entry('en', true, 'godot-db:fb:1'),
      entry('de', false, 'godot-db:fb:1'),
      entry('ja', false, 'godot-db:fb:1'),
    ]
    const result = inferNativeCultures(entries, targets)
    // "de" sorts first alphabetically, but the evidence is "en".
    expect(result[0].nativeCulture).toBe('en')
  })

  it('leaves nativeCulture unset when no base evidence exists', () => {
    const targets: LocalizationTarget[] = [
      { name: 'godot-db:fb', availableCultures: ['de', 'en', 'ja'] },
    ]
    const entries = [
      entry('de', false, 'godot-db:fb:1'),
      entry('en', false, 'godot-db:fb:1'),
    ]
    const result = inferNativeCultures(entries, targets)
    expect(result[0].nativeCulture).toBeUndefined()
  })

  it('does not override an already-known native culture', () => {
    const targets: LocalizationTarget[] = [
      { name: 'Game', nativeCulture: 'fr', availableCultures: ['en', 'fr'] },
    ]
    const entries = [entry('en', true, 'unreal:Game:ns:key')]
    const result = inferNativeCultures(entries, targets)
    expect(result[0].nativeCulture).toBe('fr')
  })
})
