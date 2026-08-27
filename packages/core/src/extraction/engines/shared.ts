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
import { extractCustomProtectedTokens } from '../../tokens'

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

/*
 * Merge user-defined custom-pattern tokens into an entry's protected segments,
 * de-duplicating by position so engine tokens and custom tokens never overlap.
 * This is the single chokepoint through which custom protection patterns flow
 * into structured extraction (Godot/Unreal/Unity/generic adapters).
 */
export function mergeCustomProtectedSegments(sourceText: string, base: ProtectedSegment[]): ProtectedSegment[] {
  const custom = extractCustomProtectedTokens(sourceText)
  if (custom.length === 0) return base
  const merged: ProtectedSegment[] = [...base]
  for (const token of custom) {
    if (!merged.some((s) => token.start < s.end && s.start < token.end)) {
      merged.push({ raw: token.raw, kind: token.kind, start: token.start, end: token.end, ruleId: token.ruleId })
    }
  }
  return merged.sort((a, b) => a.start - b.start)
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
  cultureIdentity?: string
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
    cultureIdentity: input.cultureIdentity,
    protectedSegments: mergeCustomProtectedSegments(input.sourceText, input.protectedSegments),
    protectionProfile: input.protectionProfile,
    rawMetadata: input.rawMetadata,
  }
}
