import { describe, expect, it } from 'vitest'
import { glossaryNudges } from './glossaryHints'

const glossary = [
  {
    sourceTerm: 'Settings',
    preferredTranslation: 'الإعدادات',
    forbiddenTranslations: ['ضبطات'],
    caseSensitive: false,
  },
]

describe('glossaryHints', () => {
  it('suggests a preferred term when the source matches and translation is missing it', () => {
    const nudges = glossaryNudges('Open Settings', 'افتح القائمة', glossary)
    expect(nudges).toHaveLength(1)
    expect(nudges[0].preferredMissing).toBe(true)
    expect(nudges[0].preferredTranslation).toBe('الإعدادات')
  })

  it('flags a forbidden translation quietly', () => {
    const nudges = glossaryNudges('Open Settings', 'افتح ضبطات', glossary)
    expect(nudges[0].forbiddenHit).toBe('ضبطات')
  })

  it('stays silent when the preferred term is already used', () => {
    expect(glossaryNudges('Open Settings', 'افتح الإعدادات', glossary)).toEqual([])
  })
})
