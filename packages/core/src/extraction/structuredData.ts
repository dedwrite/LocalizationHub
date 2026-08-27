/*
 * Reusable structured-data analyzer for nested JSON/CSV/key-value records.
 *
 * Recursively finds translatable text fields while classifying sibling fields
 * as context (speaker, listener, gender, scene, notes, choices). Produces
 * normalized entries with provenance — never a flat dump of every string.
 */

import {
  classifyFieldName,
  classifyString,
} from './classification'
import {
  inferContextFromRecord,
  type ContextFieldMapping,
} from './contextInference'
import type {
  EntryClassification,
  ExtractedEntry,
  FieldProvenance,
  SourceLocator,
} from './types'

export type StructuredRecord = {
  record: Record<string, unknown>
  path: string[]
  order: number
}

export type StructuredExtractionOptions = {
  engine: SourceLocator['engine']
  namespace?: string
  mappings?: ContextFieldMapping[]
  containerPath?: string
  internalAssetPath?: string
  resourceName?: string
  protectionProfile: string
  extractProtectedSegments: (text: string) => Array<{ raw: string; kind: string; start: number; end: number; ruleId: string }>
  // Fields that are always translatable regardless of heuristic scoring.
  forceTranslatableFields?: string[]
  // Fields that are never translatable (identifiers, paths, keys).
  neverTranslatableFields?: string[]
}

/*
 * Stable IDs derived from a structural path so the same source yields the same
 * ID across runs. Avoids collapsing distinct entries that share source text.
 */
export function structuralEntryId(
  parts: Array<string | number>,
): string {
  return parts
    .map((part) => String(part))
    .map((part) => part.replace(/[^A-Za-z0-9_.-]/g, '_'))
    .join('::')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/*
 * Analyze a single flat record: identify translatable text fields and context
 * fields, and emit entries. Handles the "multiple text fields in one record"
 * case (choice + response + note) by classifying each field independently.
 */
export function analyzeRecord(
  input: StructuredRecord,
  options: StructuredExtractionOptions,
): { entries: ExtractedEntry[]; context: ReturnType<typeof inferContextFromRecord>['context'] } {
  const { record, path, order } = input
  const { context, translatableFields } = inferContextFromRecord(record, options.mappings ?? [])

  const entries: ExtractedEntry[] = []
  let fieldIndex = 0

  for (const { field, role } of translatableFields) {
    const value = record[field]
    if (typeof value !== 'string' || value.trim().length === 0) continue

    const fieldName = field.toLowerCase()
    const never = (options.neverTranslatableFields ?? []).some(
      (name) => name.toLowerCase() === fieldName,
    )
    if (never) continue

    const forced = (options.forceTranslatableFields ?? []).some(
      (name) => name.toLowerCase() === fieldName,
    )

    // Sibling structure: a record with a speaker field is dialogue-shaped, so
    // its text field is Dialogue, not generic UI text.
    const hasSpeaker = Boolean(context.speaker)

    const decision = classifyString(value, {
      knownLocalizedField: role === 'translatableText',
      dialogueSchema:
        hasSpeaker ||
        (role === 'translatableText' &&
          /dialogue|line|spoken|response|utterance|quote/.test(fieldName)),
      subtitleSchema: /subtitle|caption/.test(fieldName),
      uiComponentField: /text|label|title|button|tooltip|placeholder|hint/.test(fieldName),
    })

    if (!forced && !decision.translatable) continue

    const namedClassification = classifyFieldName(field)
    let fieldClassification: EntryClassification
    if (namedClassification !== 'Unknown') {
      fieldClassification = namedClassification
    } else if (hasSpeaker) {
      fieldClassification = 'Dialogue'
    } else {
      fieldClassification = decision.classification
    }

    const classificationProvenance: FieldProvenance =
      namedClassification !== 'Unknown'
        ? { source: 'explicit-field', confidence: 'high' }
        : hasSpeaker
          ? { source: 'structural-inference', confidence: 'high' }
          : { source: 'heuristic', confidence: decision.confidence }

    const protectedSegments = options.extractProtectedSegments(value)

    entries.push({
      id: structuralEntryId([...path, field, fieldIndex]),
      key: record.key != null ? String(record.key) : undefined,
      namespace: options.namespace,
      order: order * 1000 + fieldIndex,
      sourceText: value,
      classification: forced ? (fieldClassification === 'Unknown' ? 'UI' : fieldClassification) : fieldClassification,
      classificationConfidence: forced ? 'high' : decision.confidence,
      context: {
        ...context,
        classificationProvenance,
      },
      origin: {
        engine: options.engine,
        containerPath: options.containerPath,
        internalAssetPath: options.internalAssetPath,
        resourceName: options.resourceName,
        fieldPath: [...path, field].join('.'),
        objectType: 'structured-record',
        key: record.key != null ? String(record.key) : undefined,
      },
      protectedSegments,
      protectionProfile: options.protectionProfile,
      rawMetadata: { field },
    })

    fieldIndex += 1
  }

  return { entries, context }
}

/*
 * Recursively walk a nested value, emitting structured records for analysis.
 * Arrays of objects are treated as rows; nested objects are descended into
 * with a path prefix. Scalars are only candidates at the leaf level via
 * `analyzeRecord`.
 */
export function walkStructuredData(
  value: unknown,
  options: {
    onRecord: (record: StructuredRecord) => void
    path?: string[]
    order?: { value: number }
    maxDepth?: number
    forceFlatLeaves?: boolean
  },
): void {
  const path = options.path ?? []
  const maxDepth = options.maxDepth ?? 20
  const order = options.order ?? { value: 0 }

  if (path.length > maxDepth) return

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkStructuredData(item, {
        ...options,
        path: [...path, String(index)],
      })
    })
    return
  }

  if (isObject(value)) {
    // Treat as a record if it has any string-valued leaf that looks textual.
    options.onRecord({ record: value, path, order: order.value++ })
    return
  }
}
