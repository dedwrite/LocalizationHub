import { getEffectiveEntryWorkflowStatus, type EntryWorkflowMap } from './projectModel'
import type { ParsedLocalizationEntry } from './parsers'

export type ProjectStatistics = {
  total: number; untranslated: number; draft: number; translated: number; needsReview: number; approved: number
  translationCompletion: number; approvalCompletion: number; sourceWords: number; translatedWords: number; remainingWords: number
}

export function calculateProjectStatistics(entries: ParsedLocalizationEntry[], workflow: EntryWorkflowMap): ProjectStatistics {
  const counts = { untranslated: 0, draft: 0, translated: 0, 'needs-review': 0, approved: 0 }
  let sourceWords = 0; let translatedWords = 0
  for (const entry of entries) { const status = getEffectiveEntryWorkflowStatus(entry, workflow[entry.id]); counts[status] += 1; sourceWords += wordCount(entry.source); translatedWords += wordCount(entry.translation) }
  const total = entries.length
  return { total, untranslated: counts.untranslated, draft: counts.draft, translated: counts.translated, needsReview: counts['needs-review'], approved: counts.approved, translationCompletion: total ? Math.round(((total - counts.untranslated) / total) * 100) : 0, approvalCompletion: total ? Math.round((counts.approved / total) * 100) : 0, sourceWords, translatedWords, remainingWords: Math.max(0, sourceWords - translatedWords) }
}

function wordCount(value: string): number { return value.trim() ? value.trim().split(/\s+/u).length : 0 }
