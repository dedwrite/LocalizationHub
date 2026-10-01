import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import LanguageField, { languageGlyphs } from './LanguageField'

describe('decorative language field', () => {
  it('renders exactly 40 stable decorative glyphs without runtime randomness', () => {
    const random = vi.spyOn(Math, 'random')
    try {
      const first = renderToStaticMarkup(createElement(LanguageField))
      const second = renderToStaticMarkup(createElement(LanguageField))
      expect(first).toBe(second)
      expect(random).not.toHaveBeenCalled()
      expect(first.match(/class="language-glyph /g)).toHaveLength(40)
      expect(first).toContain('aria-hidden="true"')
      expect(first).toContain('data-i18n-skip="true"')
      expect(first).not.toMatch(/<(?:button|a|input|canvas)|tabindex=/i)
    } finally {
      random.mockRestore()
    }
  })

  it('keeps all glyph geometry bounded and represents ten different scripts/forms', () => {
    expect(new Set(languageGlyphs.map(glyph => glyph.character)).size).toBe(10)
    for (const glyph of languageGlyphs) {
      expect(glyph.x).toBeGreaterThanOrEqual(0)
      expect(glyph.x).toBeLessThanOrEqual(100)
      expect(glyph.y).toBeGreaterThanOrEqual(0)
      expect(glyph.y).toBeLessThanOrEqual(100)
      expect(glyph.size).toBeLessThanOrEqual(82)
    }
  })
})
