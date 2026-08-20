import {
  parse as parseLosslessJson,
} from 'lossless-json'

import type {
  LocalizationParseResult,
  ParsedLocalizationDocument,
  ParsedLocalizationEntry,
  RecordArraySchema,
} from './types'

const KEY_FIELDS = [
  'key',
  'string_key',
  'stringKey',
  'key_name',
  'keyName',
  'name',
  'id',
]

const SOURCE_FIELDS = [
  'source',
  'source_text',
  'sourceText',
  'text',
  'value',
  'english',
  'en',
  'original',
]

const TRANSLATION_FIELDS = [
  'arabic',
  'translation',
  'translated',
  'target',
  'target_text',
  'targetText',
  'ar',
]

const CONTEXT_FIELDS = [
  'table',
  'namespace',
  'category',
  'group',
  'context',
]

const NOTES_FIELDS = [
  'notes',
  'note',
  'comment',
  'comments',
  'description',
]

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false
  }

  if (
    'isLosslessNumber' in value &&
    value.isLosslessNumber === true
  ) {
    return false
  }

  return true
}

function isStringEntry(
  entry: [string, unknown],
): entry is [string, string] {
  return typeof entry[1] === 'string'
}

function getSampleRecords(
  value: unknown[],
): Record<string, unknown>[] {
  return value
    .filter(isRecord)
    .slice(0, 250)
}

function findStringField(
  records: Record<string, unknown>[],
  candidates: string[],
): string | undefined {
  if (records.length === 0) {
    return undefined
  }

  let bestField: string | undefined
  let bestScore = 0

  for (const candidate of candidates) {
    let score = 0

    for (const record of records) {
      if (
        typeof record[candidate] ===
        'string'
      ) {
        score += 1
      }
    }

    if (score > bestScore) {
      bestField = candidate
      bestScore = score
    }
  }

  if (
    bestField &&
    bestScore >=
      Math.max(
        1,
        Math.floor(
          records.length * 0.25,
        ),
      )
  ) {
    return bestField
  }

  return undefined
}

function detectRecordArraySchema(
  array: unknown[],
): RecordArraySchema | null {
  const records =
    getSampleRecords(array)

  if (records.length === 0) {
    return null
  }

  const keyField =
    findStringField(
      records,
      KEY_FIELDS,
    )

  const sourceField =
    findStringField(
      records,
      SOURCE_FIELDS,
    )

  if (
    !keyField ||
    !sourceField
  ) {
    return null
  }

  const translationField =
    findStringField(
      records,
      TRANSLATION_FIELDS,
    )

  const contextField =
    findStringField(
      records,
      CONTEXT_FIELDS,
    )

  const notesField =
    findStringField(
      records,
      NOTES_FIELDS,
    )

  return {
    keyField,
    sourceField,
    translationField,
    contextField,
    notesField,
  }
}

function parseFlatObject(
  value: Record<string, unknown>,
  sourceText: string,
): ParsedLocalizationDocument | null {
  const entries =
    Object.entries(value)
      .filter(isStringEntry)

  if (entries.length === 0) {
    return null
  }

  const totalFields =
    Object.keys(value).length

  const stringRatio =
    entries.length /
    Math.max(1, totalFields)

  /*
   * إذا أقل من 70% من حقول الـobject
   * نصوص، غالبًا هذا JSON config أو
   * بنية مركبة وليس ملف localization
   * مسطح.
   */
  if (stringRatio < 0.7) {
    return null
  }

  const parsedEntries:
    ParsedLocalizationEntry[] =
      entries.map(
        ([key, source], index) => ({
          id:
            `flat:${index}:${key}`,

          key,
          source,
          translation: '',

          keyPath: [key],
          sourcePath: [key],
        }),
      )

  return {
    parser: 'json',
    format: 'flat-json-object',

    sourceText,
    entries: parsedEntries,
  }
}

function parseRecordArray(
  value: unknown[],
  sourceText: string,
): ParsedLocalizationDocument | null {
  const schema =
    detectRecordArraySchema(value)

  if (!schema) {
    return null
  }

  const parsedEntries:
    ParsedLocalizationEntry[] = []

  value.forEach(
    (item, index) => {
      if (!isRecord(item)) {
        return
      }

      const keyValue =
        item[schema.keyField]

      const sourceValue =
        item[schema.sourceField]

      if (
        typeof keyValue !==
          'string' ||
        typeof sourceValue !==
          'string'
      ) {
        return
      }

      const translationValue =
        schema.translationField
          ? item[
              schema
                .translationField
            ]
          : ''

      const contextValue =
        schema.contextField
          ? item[
              schema.contextField
            ]
          : undefined

      const notesValue =
        schema.notesField
          ? item[
              schema.notesField
            ]
          : undefined

      const context =
        typeof contextValue ===
          'string'
          ? contextValue
          : undefined

      const notes =
        typeof notesValue ===
          'string'
          ? notesValue
          : undefined

      const translation =
        typeof translationValue ===
          'string'
          ? translationValue
          : ''

      const id =
        context
          ? `record:${index}:${context}:${keyValue}`
          : `record:${index}:${keyValue}`

      parsedEntries.push({
        id,

        key: keyValue,
        source: sourceValue,
        translation,

        context,
        notes,

        keyPath: [
          index,
          schema.keyField,
        ],

        sourcePath: [
          index,
          schema.sourceField,
        ],

        translationPath:
          schema.translationField
            ? [
                index,
                schema
                  .translationField,
              ]
            : undefined,
      })
    },
  )

  if (
    parsedEntries.length === 0
  ) {
    return null
  }

  return {
    parser: 'json',
    format: 'json-record-array',

    sourceText,

    entries:
      parsedEntries,

    schema,
  }
}

export function parseJsonLocalization(
  text: string,
): LocalizationParseResult {
  let parsed: unknown

  try {
    parsed =
      parseLosslessJson(text)
  } catch (error) {
    console.error(error)

    return {
      ok: false,
      reason:
        'الملف ليس JSON صالحًا.',
    }
  }

  if (Array.isArray(parsed)) {
    const document =
      parseRecordArray(
        parsed,
        text,
      )

    if (document) {
      return {
        ok: true,
        document,
      }
    }

    return {
      ok: false,
      reason:
        'تم التعرف على JSON Array، لكن لم نستطع تحديد حقول key/source/translation تلقائيًا.',
    }
  }

  if (isRecord(parsed)) {
    const document =
      parseFlatObject(
        parsed,
        text,
      )

    if (document) {
      return {
        ok: true,
        document,
      }
    }

    return {
      ok: false,
      reason:
        'تم التعرف على JSON Object، لكن بنيته ليست من الأنماط المدعومة حاليًا.',
    }
  }

  return {
    ok: false,
    reason:
      'بنية JSON غير مدعومة حاليًا.',
  }
}