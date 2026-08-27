/*
 * Provenance helpers for the normalized extraction model.
 *
 * Every inferred field carries a provenance source + confidence so heuristic
 * output is never presented as guaranteed engine metadata.
 */

import type {
  Confidence,
  FieldProvenance,
  ProvenanceKind,
} from './types'

export function provenance(
  source: ProvenanceKind,
  confidence: Confidence,
): FieldProvenance {
  return { source, confidence }
}

export const explicitEngine = (confidence: Confidence = 'high'): FieldProvenance =>
  provenance('explicit-engine', confidence)

export const explicitField = (confidence: Confidence = 'high'): FieldProvenance =>
  provenance('explicit-field', confidence)

export const schemaMap = (confidence: Confidence = 'high'): FieldProvenance =>
  provenance('schema-map', confidence)

export const structuralInference = (confidence: Confidence = 'medium'): FieldProvenance =>
  provenance('structural-inference', confidence)

export const heuristic = (confidence: Confidence = 'low'): FieldProvenance =>
  provenance('heuristic', confidence)

export const userMapped = (confidence: Confidence = 'high'): FieldProvenance =>
  provenance('user-mapped', confidence)
