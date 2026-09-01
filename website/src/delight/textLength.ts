/** Quiet source/translation length comparison for UI and game strings. */

export type LengthCueKind = 'empty' | 'short' | 'balanced' | 'long' | 'very-long'

export type LengthCue = {
  kind: LengthCueKind
  sourceChars: number
  translationChars: number
  ratio: number
  /** 0–100 bar fill relative to source length (capped). */
  fill: number
}

export function measureLength(text: string): number {
  return [...text.replace(/\s+/g, ' ').trim()].length
}

export function lengthCue(source: string, translation: string): LengthCue {
  const sourceChars = measureLength(source)
  const translationChars = measureLength(translation)
  if (!translationChars) {
    return { kind: 'empty', sourceChars, translationChars: 0, ratio: 0, fill: 0 }
  }
  if (!sourceChars) {
    return { kind: 'balanced', sourceChars: 0, translationChars, ratio: 1, fill: Math.min(100, translationChars) }
  }
  const ratio = translationChars / sourceChars
  const fill = Math.min(100, Math.round(ratio * 100))
  let kind: LengthCueKind = 'balanced'
  if (ratio < 0.55) kind = 'short'
  else if (ratio > 1.85) kind = 'very-long'
  else if (ratio > 1.35) kind = 'long'
  return { kind, sourceChars, translationChars, ratio, fill }
}
