import {
  parseJsonLocalization,
} from './json'
import { parseCsvLocalization } from './csv'
import { parsePoLocalization } from './po'

import type {
  LocalizationParseResult,
  ParsedLocalizationDocument,
  ParsedLocalizationEntry,
  RecordArraySchema,
} from './types'
import type {
  GenericContextMapping,
} from './contextDetection'

export type {
  JsonPathSegment,
  LocalizationFileFormat,
  LocalizationLanguageInfo,
  LocalizationParseResult,
  ParsedLocalizationDocument,
  ParsedLocalizationEntry,
  ParsedDialogueContext,
  RecordArraySchema,
  TextDirection,
} from './types'

export {
  buildCharacterDatabase,
  detectDialogueContext,
  detectContextFields,
  inspectUnmappedFields,
  normalizeContextFieldName,
  type CharacterDatabase,
  type CharacterValue,
  type GenericContextRole,
  type GenericContextMapping,
  type ContextDetectionConfidence,
  type DetectedContextField,
  type UnmappedField,
} from './contextDetection'

export function parseLocalizationFile(
  text: string,
  fileName: string,
  mappings?: GenericContextMapping[],
): LocalizationParseResult {
  const extension =
    fileName
      .split('.')
      .pop()
      ?.toLowerCase()

  if (
    extension ===
    'json'
  ) {
    return parseJsonLocalization(
      text,
      mappings,
    )
  }

  if (extension === 'csv') return parseCsvLocalization(text, mappings)
  if (extension === 'po') return parsePoLocalization(text)

  return {
    ok: false,

    reason:
      `صيغة .${extension ?? ''} غير مدعومة حاليًا.`,
  }
}

export function describeParsedDocument(
  document:
    ParsedLocalizationDocument,
): string {
  switch (
    document.format
  ) {
    case 'flat-json-object':
      return (
        `Flat JSON Object — ` +
        `${document.entries.length.toLocaleString()} entries`
      )

    case 'json-record-array': {
      const schema:
        RecordArraySchema | undefined =
          document.schema

      if (!schema) {
        return (
          `JSON Record Array — ` +
          `${document.entries.length.toLocaleString()} entries`
        )
      }

      return [
        'JSON Record Array',

        `${document.entries.length.toLocaleString()} entries`,

        `key: ${schema.keyField ?? 'index'}`,

        `source: ${schema.sourceField}`,

        `translation: ${
          schema.translationField ??
          'not detected'
        }`,
      ].join(
        ' | ',
      )
    }

    case 'csv':
      return `CSV — ${document.entries.length.toLocaleString()} entries`

    case 'gettext-po':
      return `Gettext PO — ${document.entries.length.toLocaleString()} entries`
  }
}

export function getEntryById(
  document:
    ParsedLocalizationDocument,

  id:
    string,
): ParsedLocalizationEntry | undefined {
  return document.entries.find(
    (entry) =>
      entry.id === id,
  )
}