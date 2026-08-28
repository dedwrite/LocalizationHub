/*
 * Role-scoped "Has Gender" filter semantics.
 *
 * Has Gender means speakerGender OR listenerGender OR grammaticalGender — never
 * inferred. Unknown is treated as absent.
 */

import { describe, expect, it } from 'vitest'
import { matchesReviewFilter } from './extractionReview'

function entry(context?: Record<string, unknown>) {
  return {
    classification: 'Dialogue' as const,
    classificationConfidence: 'high',
    context: context as { speaker?: string; listener?: string; listeners?: string[]; speakerGender?: string; listenerGender?: string; grammaticalGender?: string; scene?: string; conversationId?: string },
    protectedSegments: [],
  }
}

describe('Has Gender filter', () => {
  it('matches speaker gender', () => {
    expect(matchesReviewFilter(entry({ speakerGender: 'male' }), 'has-gender')).toBe(true)
  })

  it('matches listener gender (role-scoped, not just speaker)', () => {
    expect(matchesReviewFilter(entry({ listenerGender: 'female' }), 'has-gender')).toBe(true)
  })

  it('matches grammatical gender', () => {
    expect(matchesReviewFilter(entry({ grammaticalGender: 'female' }), 'has-gender')).toBe(true)
  })

  it('does NOT match when only unknown/absent gender', () => {
    expect(matchesReviewFilter(entry({ speakerGender: 'unknown' }), 'has-gender')).toBe(false)
    expect(matchesReviewFilter(entry({ speaker: 'Mark' }), 'has-gender')).toBe(false)
  })
})
