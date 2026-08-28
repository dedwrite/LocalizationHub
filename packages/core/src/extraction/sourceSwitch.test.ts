/*
 * Source-language switch correctness tests.
 *
 * Pins the review's "Source language" selector behaviour:
 *   - switching locale changes sourceText/sourceLocale but NOT id /
 *     classification / context identity
 *   - protected segments are re-derived from the newly-selected locale's text
 *   - switching back round-trips exactly
 */

import { describe, expect, it } from 'vitest'
import { aggregateCultures, overrideSourceCulture } from './cultureAggregation'
import type { ExtractedEntry } from './types'

function entry(sourceLocale: string, text: string, isSourceLocale: boolean): ExtractedEntry {
  return {
    id: 'id-1',
    key: 'k',
    order: 0,
    sourceText: text,
    sourceLocale,
    classification: 'Dialogue',
    classificationConfidence: 'high',
    context: { speaker: 'Mark', speakerId: 'MarkBorja', conversationId: 'inkb:1', scene: '1/1c' },
    origin: { engine: 'godot' },
    cultureIdentity: 'godot-inkb:1/1c:0',
    protectedSegments: [],
    protectionProfile: 'unreal',
    rawMetadata: { isSourceLocale },
  }
}

describe('source-language switch', () => {
  it('round-trips en -> ja -> en with stable identity', () => {
    const en = entry('en', 'Hello {0}', true)
    const ja = entry('ja', 'こんにちは {0}', false)
    const { entries } = aggregateCultures([en, ja])

    const switched = overrideSourceCulture(entries, 'ja')
    expect(switched[0].sourceText).toBe('こんにちは {0}')
    expect(switched[0].sourceLocale).toBe('ja')
    expect(switched[0].id).toBe(entries[0].id)
    expect(switched[0].classification).toBe('Dialogue')
    expect(switched[0].context?.speakerId).toBe('MarkBorja')
    expect(switched[0].context?.conversationId).toBe('inkb:1')

    // Switch back: exact round-trip.
    const back = overrideSourceCulture(switched, 'en')
    expect(back[0].sourceText).toBe('Hello {0}')
    expect(back[0].sourceLocale).toBe('en')
    expect(back[0].localeVariants?.map((v) => v.locale)).toEqual(['ja'])
  })

  it('re-derives protected segments from the newly-selected locale text', () => {
    const en = entry('en', 'Hello {0}', true)
    const ja = entry('ja', 'こんにちは {1}', false)
    const { entries } = aggregateCultures([en, ja])

    const switched = overrideSourceCulture(entries, 'ja')
    // The English source carried {0}; after switching to ja the token must be {1}.
    expect(switched[0].protectedSegments.some((s) => s.raw === '{1}')).toBe(true)
    expect(switched[0].protectedSegments.some((s) => s.raw === '{0}')).toBe(false)
  })

  it('leaves entries without a variant for the selected locale unchanged', () => {
    const en = entry('en', 'Hello', true)
    const { entries } = aggregateCultures([en])
    const switched = overrideSourceCulture(entries, 'ja')
    expect(switched[0].sourceText).toBe('Hello')
    expect(switched[0].sourceLocale).toBe('en')
  })
})
