import { describe, expect, it } from 'vitest'
import { ambienceTipKey, dayPart, greetingKey } from './timeAmbience'

describe('timeAmbience', () => {
  it('maps hours into quiet day parts', () => {
    expect(dayPart(new Date('2026-09-01T08:00:00'))).toBe('morning')
    expect(dayPart(new Date('2026-09-01T14:00:00'))).toBe('afternoon')
    expect(dayPart(new Date('2026-09-01T19:00:00'))).toBe('evening')
    expect(dayPart(new Date('2026-09-01T01:00:00'))).toBe('late')
  })

  it('returns bilingual message keys for each part', () => {
    expect(greetingKey('morning')).toBe('quiet.greetMorning')
    expect(ambienceTipKey('late')).toBe('quiet.tipLate')
  })
})
