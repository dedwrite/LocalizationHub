import type { CSSProperties } from 'react'

// A composed scatter, not runtime randomness: SSR and hydration share the same
// geometry. The decoration has no pointer, selection or accessibility surface.
// `size` is a multiple of the landing's fs-5 step, so the field never declares a
// font size outside the public type scale.
export const languageGlyphs = [
  { character: 'ع', x: 3, y: 12, size: 82, tilt: -12, tone: 'violet' },
  { character: 'あ', x: 92, y: 5, size: 58, tilt: 10, tone: 'gray' },
  { character: 'Ж', x: 7, y: 69, size: 48, tilt: 8, tone: 'gray' },
  { character: '한', x: 94, y: 49, size: 74, tilt: -10, tone: 'violet' },
  { character: 'é', x: 18, y: 4, size: 40, tilt: -18, tone: 'dim' },
  { character: '字', x: 81, y: 86, size: 60, tilt: 8, tone: 'dim' },
  { character: 'م', x: 2, y: 93, size: 66, tilt: 16, tone: 'violet' },
  { character: 'Ω', x: 87, y: 28, size: 40, tilt: -16, tone: 'dim' },
  { character: 'ก', x: 44, y: 96, size: 50, tilt: 12, tone: 'gray' },
  { character: 'क', x: 97, y: 93, size: 46, tilt: 9, tone: 'gray' },
] as const

export default function LanguageField() {
  return (
    <div className="language-field" aria-hidden="true" data-i18n-skip>
      {[0, 1, 2, 3].map(cluster => (
        <div className="language-field-cluster" key={cluster}>
          {languageGlyphs.map((glyph, index) => (
            <span
              key={glyph.character}
              className={`language-glyph tone-${glyph.tone}`}
              style={{
                '--glyph-x': `${cluster % 2 ? 100 - glyph.x : glyph.x}%`,
                '--glyph-y': `${glyph.y}%`,
                '--glyph-scale': `${Number((glyph.size / 24).toFixed(4))}`,
                '--glyph-tilt': `${glyph.tilt}deg`,
              } as CSSProperties}
            >
              {languageGlyphs[(index + cluster * 3) % languageGlyphs.length].character}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
