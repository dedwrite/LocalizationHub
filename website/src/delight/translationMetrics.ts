export type TranslationLengthTone = 'empty' | 'compact' | 'balanced' | 'expanded'

export type TranslationMetrics = {
  sourceCharacters: number
  translationCharacters: number
  ratio: number
  percentage: number
  tone: TranslationLengthTone
}

export function characterCount(value: string): number {
  return Array.from(value.trim()).length
}

export function translationMetrics(source: string, translation: string): TranslationMetrics {
  const sourceCharacters = characterCount(source)
  const translationCharacters = characterCount(translation)
  const ratio = sourceCharacters > 0 ? translationCharacters / sourceCharacters : translationCharacters > 0 ? 1 : 0
  const percentage = sourceCharacters > 0 ? Math.round(ratio * 100) : translationCharacters > 0 ? 100 : 0
  const tone: TranslationLengthTone = translationCharacters === 0
    ? 'empty'
    : ratio < 0.65
      ? 'compact'
      : ratio > 1.35
        ? 'expanded'
        : 'balanced'
  return { sourceCharacters, translationCharacters, ratio, percentage, tone }
}

export function meterWidth(metrics: TranslationMetrics): number {
  if (metrics.translationCharacters === 0) return 0
  return Math.max(3, Math.min(100, metrics.percentage))
}
