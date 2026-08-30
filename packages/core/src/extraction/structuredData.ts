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
  resolveFieldRole,
  type ContextFieldMapping,
} from './contextInference'
import { mergeCustomProtectedSegments } from './engines/shared'
import { participantObject } from '../dialogueRoles'
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

    const protectedSegments = mergeCustomProtectedSegments(
      value,
      options.extractProtectedSegments(value),
    )

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

  // --- UI-text fallback: fields that are NOT recognized as context or as an
  // explicit translatable alias, but whose NAME strongly suggests display text
  // (name / title / description / category / status / post / comment / etc.).
  // These are the dominant field names in real game databases (e.g. Until
  // Then's fb.json / email.json / characters.json). Values still pass the
  // classifyString heuristic, so paths, GUIDs, counts, and identifiers are
  // excluded — only natural-language or single-name display text is kept. ---
  for (const [fieldName, value] of Object.entries(record)) {
    if (typeof value !== 'string' || value.trim().length === 0) continue
    // Skip fields already handled as translatable or context above.
    if (resolveFieldRole(fieldName, options.mappings ?? [])) continue
    const normalized = fieldName.toLowerCase()
    if ((options.neverTranslatableFields ?? []).some((n) => n.toLowerCase() === normalized)) continue
    if (!isUiTextField(normalized)) continue

    const decision = classifyString(value, { uiComponentField: true })
    if (!decision.translatable) continue

    const namedClassification = classifyFieldName(fieldName)
    const fieldClassification: EntryClassification =
      namedClassification !== 'Unknown' ? namedClassification : decision.classification

    entries.push({
      id: structuralEntryId([...path, fieldName, fieldIndex]),
      key: record.key != null ? String(record.key) : undefined,
      namespace: options.namespace,
      order: order * 1000 + fieldIndex,
      sourceText: value,
      classification: fieldClassification,
      classificationConfidence: decision.confidence,
      context: {
        ...context,
        classificationProvenance: { source: 'explicit-field', confidence: 'high' },
      },
      origin: {
        engine: options.engine,
        containerPath: options.containerPath,
        internalAssetPath: options.internalAssetPath,
        resourceName: options.resourceName,
        fieldPath: [...path, fieldName].join('.'),
        objectType: 'structured-record',
        key: record.key != null ? String(record.key) : undefined,
      },
      protectedSegments: mergeCustomProtectedSegments(
        value,
        options.extractProtectedSegments(value),
      ),
      protectionProfile: options.protectionProfile,
      rawMetadata: { field: fieldName },
    })

    fieldIndex += 1
  }

  return { entries, context }
}

/*
 * Field names that strongly imply displayed text in structured game data.
 * Deliberately conservative: identifier-like names (id/key/guid/path/uid) are
 * excluded by the neverTranslatableFields list, and every value still passes
 * the classifyString heuristic.
 */
function isUiTextField(fieldName: string): boolean {
  return /^(name|title|description|desc|category|status|subject|body|post|comment|headline|bio|nickname|first_name|firstname|last_name|lastname|label|header|footer|caption|subtitle|tooltip|placeholder|hint|summary|details|about|tagline|slogan|display_name|displayname|username|full_name|fullname)$/u.test(fieldName)
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
    mappings?: ContextFieldMapping[]
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
    // Descend into nested objects/arrays so deep structures (Unity type
    // trees, nested dialogue databases, UAsset property trees) are reached.
    for (const [key, child] of Object.entries(value)) {
      // Simple participant objects belong to the parent record's context,
      // not a second set of translatable name/gender rows.
      const role = resolveFieldRole(key, options.mappings)?.role
      if (role && ['speaker', 'speakerId', 'listener', 'listeners', 'listenerId', 'listenerIds'].includes(role)) {
        if (participantObject(child)) continue
        if (Array.isArray(child) && child.every((item) => item == null || typeof item !== 'object' || participantObject(item))) continue
      }
      if (isObject(child) || Array.isArray(child)) {
        walkStructuredData(child, {
          ...options,
          path: [...path, key],
        })
      }
    }
    return
  }
}
