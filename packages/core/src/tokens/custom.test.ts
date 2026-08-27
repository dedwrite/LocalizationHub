import { describe, expect, it } from 'vitest'

import {
  createCustomTokenProfile,
  previewCustomPattern,
  validateCustomPattern,
  setCustomTokenProfile,
  getTokenProfile,
  extractProtectedTokens,
} from './index'

describe('custom protected patterns', () => {
  it('accepts a valid pattern and previews matches', () => {
    expect(validateCustomPattern('\\[\\[\\w+\\]\\]')).toEqual({ valid: true })

    const preview = previewCustomPattern('\\[\\[\\w+\\]\\]', 'Use [[STRENGTH]] and [[AGILITY]].')
    expect(preview.valid).toBe(true)
    expect(preview.matches.map((m) => m.raw)).toEqual(['[[STRENGTH]]', '[[AGILITY]]'])
  })

  it('rejects invalid regex', () => {
    const result = validateCustomPattern('([unclosed')
    expect(result.valid).toBe(false)
  })

  it('rejects empty patterns', () => {
    const result = validateCustomPattern('   ')
    expect(result.valid).toBe(false)
  })

  it('builds a profile that extracts custom tokens', () => {
    const profile = createCustomTokenProfile([
      { id: 'stat', label: 'Stat token', pattern: '\\[\\[\\w+\\]\\]' },
    ])

    expect(profile.id).toBe('custom')
    const tokens = profile.extract('Pick up the [[SWORD]].')
    expect(tokens.map((t) => t.raw)).toEqual(['[[SWORD]]'])
  })

  it('skips invalid patterns instead of throwing', () => {
    const profile = createCustomTokenProfile([
      { id: 'bad', label: 'Bad', pattern: '(' },
      { id: 'good', label: 'Good', pattern: '<%[^%]+%>' },
    ])
    const tokens = profile.extract('Hello <%name%>.')
    expect(tokens.map((t) => t.raw)).toEqual(['<%name%>'])
  })

  it('registers under the custom profile id', () => {
    const profile = createCustomTokenProfile([
      { id: 'brace', label: 'Brace', pattern: '\\{#[A-Za-z]+\\}' },
    ])

    setCustomTokenProfile(profile)
    expect(getTokenProfile('custom').id).toBe('custom')
    expect(extractProtectedTokens('Level {#MAX}', 'custom').map((t) => t.raw)).toEqual(['{#MAX}'])

    // Fall back to generic when unset.
    setCustomTokenProfile(undefined)
    expect(getTokenProfile('custom').id).toBe('generic')
  })
})
