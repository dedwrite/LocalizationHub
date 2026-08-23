import {
  parseJsonLocalization,
} from './json'

import type {
  LocalizationParseResult,
  ParsedLocalizationDocument,
  ParsedLocalizationEntry,
  RecordArraySchema,
} from './types'

export type {
  JsonPathSegment,
  LocalizationFileFormat,
  LocalizationLanguageInfo,
  LocalizationParseResult,
  ParsedLocalizationDocument,
  ParsedLocalizationEntry,
  RecordArraySchema,
  TextDirection,
} from './types'

export function parseLocalizationFile(
  text: string,
  fileName: string,
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
    )
  }

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

        `key: ${schema.keyField}`,

        `source: ${schema.sourceField}`,

        `translation: ${
          schema.translationField ??
          'not detected'
        }`,
      ].join(
        ' | ',
      )
    }
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