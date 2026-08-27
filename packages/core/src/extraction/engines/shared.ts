/*
 * Shared helpers for engine adapters.
 */

import type {
  Confidence,
  EntryClassification,
  ExtractedEntry,
  ProtectedSegment,
  SourceLocator,
} from '../types'

export function toProtectedSegments(
  tokens: Array<{ raw: string; kind: string; start: number; end: number; ruleId: string }>,
): ProtectedSegment[] {
  return tokens.map((token) => ({
    raw: token.raw,
    kind: token.kind,
    start: token.start,
    end: token.end,
    ruleId: token.ruleId,
  }))
}

export type BuildEntryInput = {
  id: string
  key?: string
  namespace?: string
  order: number
  sourceText: string
  sourceLocale?: string
  existingTranslation?: string
  pluralVariants?: Array<{ quantity: string; text: string }>
  classification: EntryClassification
  classificationConfidence: Confidence
  context?: ExtractedEntry['context']
  origin: SourceLocator
  protectedSegments: ProtectedSegment[]
  protectionProfile: string
  rawMetadata?: Record<string, unknown>
}

export function buildEntry(input: BuildEntryInput): ExtractedEntry {
  return {
    id: input.id,
    key: input.key,
    namespace: input.namespace,
    order: input.order,
    sourceText: input.sourceText,
    sourceLocale: input.sourceLocale,
    existingTranslation: input.existingTranslation,
    pluralVariants: input.pluralVariants,
    classification: input.classification,
    classificationConfidence: input.classificationConfidence,
    context: input.context,
    origin: input.origin,
    protectedSegments: input.protectedSegments,
    protectionProfile: input.protectionProfile,
    rawMetadata: input.rawMetadata,
  }
}
