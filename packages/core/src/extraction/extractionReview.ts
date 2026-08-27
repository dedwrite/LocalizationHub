/*
 * Extraction review aggregation.
 *
 * Computes review-facing stats and filter buckets from a normalized extraction
 * result, powering the Extraction Review UI without re-scanning sources.
 */

import type {
  EntryClassification,
  ExtractionResult,
  ExtractionStats,
} from './types'

export function computeExtractionStats(
  result: ExtractionResult,
): ExtractionStats {
  const byClassification: Partial<Record<EntryClassification, number>> = {}
  let protectedTokenCount = 0
  let entriesWithSpeaker = 0
  let entriesWithListener = 0
  let entriesWithExplicitGender = 0
  let entriesWithInferredContext = 0
  let warnings = 0
  let errors = 0

  const conversationIds = new Set<string>()

  for (const entry of result.entries) {
    byClassification[entry.classification] = (byClassification[entry.classification] ?? 0) + 1
    protectedTokenCount += entry.protectedSegments.length

    if (entry.context?.speaker) entriesWithSpeaker += 1
    if (entry.context?.listener || (entry.context?.listeners?.length ?? 0) > 0) entriesWithListener += 1
    if (entry.context?.speakerGender && entry.context.speakerGender !== 'unknown') entriesWithExplicitGender += 1
    if (
      entry.context?.speaker ||
      entry.context?.listener ||
      entry.context?.scene ||
      entry.context?.developerNote ||
      entry.context?.conversationId
    ) {
      entriesWithInferredContext += 1
    }
    if (entry.context?.conversationId) conversationIds.add(entry.context.conversationId)
  }

  for (const diagnostic of result.diagnostics) {
    if (diagnostic.kind === 'low-confidence' || diagnostic.kind === 'partial-extraction') {
      warnings += 1
    } else {
      errors += 1
    }
  }

  return {
    filesScanned: 0,
    candidateFiles: 0,
    entriesFound: result.entries.length,
    byClassification,
    protectedTokenCount,
    entriesWithSpeaker,
    entriesWithListener,
    entriesWithExplicitGender,
    entriesWithInferredContext,
    conversationGroups: conversationIds.size,
    warnings,
    errors,
  }
}

export type ReviewFilterId =
  | 'all'
  | 'dialogue'
  | 'subtitle'
  | 'ui'
  | 'uncertain'
  | 'excluded'
  | 'has-speaker'
  | 'has-listener'
  | 'has-gender'
  | 'has-protected-tokens'
  | 'warnings'

export const REVIEW_FILTERS: Array<{ id: ReviewFilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'dialogue', label: 'Dialogue' },
  { id: 'subtitle', label: 'Subtitles' },
  { id: 'ui', label: 'UI' },
  { id: 'uncertain', label: 'Uncertain' },
  { id: 'excluded', label: 'Excluded' },
  { id: 'has-speaker', label: 'Has Speaker' },
  { id: 'has-listener', label: 'Has Listener' },
  { id: 'has-gender', label: 'Has Gender' },
  { id: 'has-protected-tokens', label: 'Has Protected Tokens' },
  { id: 'warnings', label: 'Warnings' },
]

export function matchesReviewFilter(
  entry: { classification: EntryClassification; classificationConfidence: string; context?: { speaker?: string; listener?: string; listeners?: string[]; speakerGender?: string }; protectedSegments: unknown[] },
  filter: ReviewFilterId,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'dialogue':
      return entry.classification === 'Dialogue'
    case 'subtitle':
      return entry.classification === 'Subtitle'
    case 'ui':
      return entry.classification === 'UI' || entry.classification === 'Menu'
    case 'uncertain':
      return entry.classificationConfidence === 'low'
    case 'excluded':
      return entry.classification === 'NonTranslatable'
    case 'has-speaker':
      return Boolean(entry.context?.speaker)
    case 'has-listener':
      return Boolean(entry.context?.listener || (entry.context?.listeners?.length ?? 0) > 0)
    case 'has-gender':
      return Boolean(entry.context?.speakerGender && entry.context.speakerGender !== 'unknown')
    case 'has-protected-tokens':
      return entry.protectedSegments.length > 0
    case 'warnings':
      return entry.classificationConfidence === 'low' || entry.classification === 'Unknown'
  }
}
