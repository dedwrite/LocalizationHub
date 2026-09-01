import type { GlossaryEntry } from '@localizationhub/core'

export type GlossaryNudgeItem = {
  sourceTerm: string
  preferredTranslation: string
  forbiddenHit: string | null
  preferredMissing: boolean
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function termInText(term: string, text: string, caseSensitive: boolean): boolean {
  if (!term.trim() || !text) return false
  const flags = caseSensitive ? 'g' : 'gi'
  return new RegExp(`(?:^|\\W)${escapeRegExp(term)}(?=$|\\W)`, flags).test(text)
}

/** Calm guidance for glossary terms found in the source. Never auto-writes. */
export function glossaryNudges(source: string, translation: string, glossary: GlossaryEntry[]): GlossaryNudgeItem[] {
  const items: GlossaryNudgeItem[] = []
  for (const term of glossary) {
    if (!term.sourceTerm.trim()) continue
    if (!termInText(term.sourceTerm, source, term.caseSensitive)) continue
    const forbiddenHit = term.forbiddenTranslations.find((value) => termInText(value, translation, term.caseSensitive)) ?? null
    const preferredMissing = Boolean(term.preferredTranslation)
      && !termInText(term.preferredTranslation, translation, term.caseSensitive)
    // Show only when there is something useful to notice.
    if (!term.preferredTranslation && !forbiddenHit) continue
    if (!preferredMissing && !forbiddenHit) continue
    items.push({
      sourceTerm: term.sourceTerm,
      preferredTranslation: term.preferredTranslation,
      forbiddenHit,
      preferredMissing,
    })
  }
  return items.slice(0, 3)
}
