import { describe, expect, it } from 'vitest'
import { characterCount, meterWidth, translationMetrics } from './translationMetrics'

describe('translation length metrics', () => {
  it('counts Unicode code points rather than UTF-16 units', () => {
    expect(characterCount('A👋B')).toBe(3)
  })

  it('classifies empty, compact, balanced and expanded translations', () => {
    expect(translationMetrics('1234567890', '').tone).toBe('empty')
    expect(translationMetrics('1234567890', '123').tone).toBe('compact')
    expect(translationMetrics('1234567890', '12345678').tone).toBe('balanced')
    expect(translationMetrics('1234567890', '123456789012345').tone).toBe('expanded')
  })

  it('caps only the visual meter while preserving the honest percentage', () => {
    const metrics = translationMetrics('four', 'a much longer translation')
    expect(metrics.percentage).toBeGreaterThan(100)
    expect(meterWidth(metrics)).toBe(100)
  })
})
