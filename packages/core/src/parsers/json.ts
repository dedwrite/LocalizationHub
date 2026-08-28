import {
  parse as parseLosslessJson,
} from 'lossless-json'

import type {
  LocalizationLanguageInfo,
  LocalizationParseResult,
  ParsedLocalizationDocument,
  ParsedLocalizationEntry,
  RecordArraySchema,
  TextDirection,
} from './types'

import {
  buildCharacterDatabase,
  detectContextFields,
  detectDialogueContext,
  type CharacterDatabase,
} from './contextDetection'

const KEY_FIELDS = [
  'key',
  'string_key',
  'stringKey',
  'key_name',
  'keyName',
  'entry_id',
  'entryId',
  'id',
  'name',
]

/*
 * الحقول الأكثر تحديدًا تأتي أولًا.
 *
 * مهم جدًا:
 * بعض الملفات عندها field اسمه
 * "source" لكنه يعني اسم المصدر،
 * وليس النص الإنجليزي نفسه.
 *
 * لذلك text_en يسبق source.
 */
const SOURCE_FIELDS = [
  'text_en',
  'textEn',
  'source_text',
  'sourceText',
  'english',
  'en',
  'original',
  'text',
  'value',
  'source',
]

const TRANSLATION_FIELDS = [
  'text_ar',
  'textAr',
  'arabic',
  'translation',
  'translated',
  'target',
  'target_text',
  'targetText',
  'ar',
]

const CONTEXT_FIELDS = [
  'scene',
  'table',
  'chapter',
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

/*
 * بعض الملفات توفر اللغة صراحة
 * كـmetadata بجانب النص.
 */
const SOURCE_LOCALE_FIELDS = [
  'source_locale',
  'sourceLocale',
  'source_language',
  'sourceLanguage',
  'original_locale',
  'originalLocale',
  'original_language',
  'originalLanguage',
]

const TRANSLATION_LOCALE_FIELDS = [
  'target_locale',
  'targetLocale',
  'target_language',
  'targetLanguage',
  'translation_locale',
  'translationLocale',
  'translation_language',
  'translationLanguage',
]

/*
 * أسماء لغات شائعة قد تظهر
 * كاسم field بدل locale code.
 */
const LANGUAGE_NAME_TO_LOCALE:
  Record<string, string> = {
    english: 'en',
    arabic: 'ar',
    hebrew: 'he',
    persian: 'fa',
    farsi: 'fa',
    urdu: 'ur',
    french: 'fr',
    spanish: 'es',
    german: 'de',
    italian: 'it',
    portuguese: 'pt',
    russian: 'ru',
    ukrainian: 'uk',
    polish: 'pl',
    turkish: 'tr',
    japanese: 'ja',
    korean: 'ko',
    chinese: 'zh',
  }

/*
 * لغات تُكتب غالبًا من اليمين
 * إلى اليسار.
 *
 * إذا ما عرفنا اللغة، نرجع auto
 * بدل التخمين.
 */
const RTL_LANGUAGE_CODES =
  new Set([
    'ar',
    'he',
    'fa',
    'ur',
    'ps',
    'sd',
    'ug',
    'yi',
    'dv',
    'ckb',
  ])

type LosslessNumberLike = {
  isLosslessNumber: true
  value: string
}

function isLosslessNumberValue(
  value: unknown,
): value is LosslessNumberLike {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return false
  }

  return (
    'isLosslessNumber' in value &&
    value.isLosslessNumber === true &&
    'value' in value &&
    typeof value.value === 'string'
  )
}

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

  /*
   * LosslessNumber نفسه object،
   * لكنه مو JSON record.
   */
  if (
    isLosslessNumberValue(value)
  ) {
    return false
  }

  return true
}

function isStringEntry(
  entry: [string, unknown],
): entry is [string, string] {
  return (
    typeof entry[1] ===
    'string'
  )
}

function scalarToString(
  value: unknown,
): string | undefined {
  if (
    typeof value === 'string'
  ) {
    return value
  }

  if (
    typeof value === 'number'
  ) {
    return String(value)
  }

  if (
    isLosslessNumberValue(value)
  ) {
    return value.value
  }

  return undefined
}

function getSampleRecords(
  value: unknown[],
): Record<string, unknown>[] {
  return value
    .filter(isRecord)
    .slice(0, 250)
}

function findStringField(
  records:
    Record<string, unknown>[],
  candidates:
    string[],
): string | undefined {
  if (
    records.length === 0
  ) {
    return undefined
  }

  let bestField:
    | string
    | undefined

  let bestScore = 0

  for (
    const candidate
    of candidates
  ) {
    let score = 0

    for (
      const record
      of records
    ) {
      if (
        typeof record[candidate] ===
        'string'
      ) {
        score += 1
      }
    }

    if (
      score > bestScore
    ) {
      bestField =
        candidate

      bestScore =
        score
    }
  }

  if (
    bestField &&
    bestScore >=
      Math.max(
        1,
        Math.floor(
          records.length *
            0.25,
        ),
      )
  ) {
    return bestField
  }

  return undefined
}

/*
 * الـkey قد يكون:
 *
 * "HELLO_WORLD"
 * 123
 * LosslessNumber(123)
 *
 * لذلك ما نقيده بالـstring فقط.
 */
function findScalarField(
  records:
    Record<string, unknown>[],
  candidates:
    string[],
): string | undefined {
  if (
    records.length === 0
  ) {
    return undefined
  }

  let bestField:
    | string
    | undefined

  let bestScore = 0

  for (
    const candidate
    of candidates
  ) {
    let score = 0

    for (
      const record
      of records
    ) {
      if (
        scalarToString(
          record[candidate],
        ) !== undefined
      ) {
        score += 1
      }
    }

    if (
      score > bestScore
    ) {
      bestField =
        candidate

      bestScore =
        score
    }
  }

  if (
    bestField &&
    bestScore >=
      Math.max(
        1,
        Math.floor(
          records.length *
            0.25,
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
    getSampleRecords(
      array,
    )

  if (
    records.length === 0
  ) {
    return null
  }

  /*
   * key يسمح string أو number.
   */
  const keyField =
    findScalarField(
      records,
      KEY_FIELDS,
    )

  /*
   * source لازم يكون نصًا.
   */
  const sourceField =
    findStringField(
      records,
      SOURCE_FIELDS,
    )

  if (
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

/*
 * يحول:
 *
 * textAr
 * sourceLocale
 *
 * إلى:
 *
 * text_ar
 * source_locale
 *
 * حتى يكون تحليل اسم الحقل أسهل.
 */
function normalizeFieldName(
  fieldName: string,
): string {
  return fieldName
    .replace(
      /([a-z0-9])([A-Z])/g,
      '$1_$2',
    )
    .replace(
      /-/g,
      '_',
    )
    .toLowerCase()
}

/*
 * نقبل locale codes البسيطة مثل:
 *
 * en
 * ar
 * pt-BR
 * zh-Hans
 *
 * ونرفض النصوص الطويلة العشوائية.
 */
function normalizeLocale(
  value: string,
): string | undefined {
  const trimmed =
    value.trim()

  if (
    !/^[A-Za-z]{2,3}(?:[-_][A-Za-z]{2,8}){0,2}$/
      .test(
        trimmed,
      )
  ) {
    return undefined
  }

  const parts =
    trimmed
      .replace(
        /_/g,
        '-',
      )
      .split('-')

  const language =
    parts[0]
      .toLowerCase()

  if (
    parts.length === 1
  ) {
    return language
  }

  const normalizedParts =
    parts
      .slice(1)
      .map(
        (part) => {
          if (
            part.length === 2
          ) {
            return (
              part
                .toUpperCase()
            )
          }

          if (
            part.length === 4
          ) {
            return (
              part[0]
                .toUpperCase() +
              part
                .slice(1)
                .toLowerCase()
            )
          }

          return (
            part
              .toLowerCase()
          )
        },
      )

  return [
    language,
    ...normalizedParts,
  ].join('-')
}

/*
 * نحاول معرفة locale من اسم
 * field نفسه.
 *
 * Examples:
 *
 * text_en      -> en
 * textEn       -> en
 * text_ar      -> ar
 * arabic       -> ar
 * english      -> en
 * translation_ja -> ja
 * text_pt_br   -> pt-BR
 */
function inferLocaleFromFieldName(
  fieldName:
    string | undefined,
): string | undefined {
  if (!fieldName) {
    return undefined
  }

  const normalizedName =
    normalizeFieldName(
      fieldName,
    )

  const directLanguageName =
    LANGUAGE_NAME_TO_LOCALE[
      normalizedName
    ]

  if (
    directLanguageName
  ) {
    return (
      directLanguageName
    )
  }

  const parts =
    normalizedName
      .split('_')
      .filter(Boolean)

  /*
   * source_arabic
   * target_french
   */
  const lastPart =
    parts[
      parts.length - 1
    ]

  if (
    lastPart &&
    LANGUAGE_NAME_TO_LOCALE[
      lastPart
    ]
  ) {
    return (
      LANGUAGE_NAME_TO_LOCALE[
        lastPart
      ]
    )
  }

  /*
   * لو اسم الحقل نفسه locale:
   *
   * en
   * ar
   */
  if (
    parts.length === 1
  ) {
    return normalizeLocale(
      parts[0],
    )
  }

  /*
   * text_pt_br
   * translation_zh_hans
   *
   * نجرب آخر جزئين أولًا.
   */
  if (
    parts.length >= 3
  ) {
    const possibleLocale =
      normalizeLocale(
        [
          parts[
            parts.length - 2
          ],

          parts[
            parts.length - 1
          ],
        ].join('-'),
      )

    if (
      possibleLocale
    ) {
      return possibleLocale
    }
  }

  /*
   * text_en
   * text_ar
   * translation_ja
   */
  if (
    lastPart
  ) {
    return normalizeLocale(
      lastPart,
    )
  }

  return undefined
}

/*
 * لو الملف يوفر source_locale
 * أو target_locale، نفضله على
 * التخمين من اسم الحقل.
 *
 * نأخذ القيمة الأكثر شيوعًا
 * داخل sample records.
 */
function findLocaleFromMetadata(
  records:
    Record<string, unknown>[],
  candidates:
    string[],
): string | undefined {
  const counts =
    new Map<string, number>()

  for (
    const candidate
    of candidates
  ) {
    for (
      const record
      of records
    ) {
      const value =
        record[candidate]

      if (
        typeof value !==
        'string'
      ) {
        continue
      }

      const locale =
        normalizeLocale(
          value,
        )

      if (!locale) {
        continue
      }

      counts.set(
        locale,
        (
          counts.get(
            locale,
          ) ?? 0
        ) + 1,
      )
    }
  }

  let bestLocale:
    | string
    | undefined

  let bestScore = 0

  for (
    const [
      locale,
      score,
    ]
    of counts
  ) {
    if (
      score > bestScore
    ) {
      bestLocale =
        locale

      bestScore =
        score
    }
  }

  return bestLocale
}

function directionForLocale(
  locale:
    string | undefined,
): TextDirection {
  if (!locale) {
    return 'auto'
  }

  const normalized =
    locale
      .replace(
        /_/g,
        '-',
      )
      .toLowerCase()

  const parts =
    normalized.split('-')

  const language =
    parts[0]

  /*
   * Script tags:
   *
   * az-Arab
   * ku-Arab
   * yi-Hebr
   */
  if (
    parts.includes(
      'arab',
    ) ||
    parts.includes(
      'hebr',
    )
  ) {
    return 'rtl'
  }

  if (
    RTL_LANGUAGE_CODES.has(
      language,
    )
  ) {
    return 'rtl'
  }

  /*
   * طالما عرفنا locale صالح،
   * والباقي ليس من لغات RTL،
   * اتجاه الكتابة القياسي LTR.
   */
  return 'ltr'
}

function detectLanguageInfo(
  records:
    Record<string, unknown>[],
  schema:
    RecordArraySchema,
): LocalizationLanguageInfo {
  /*
   * Metadata الصريح له الأولوية.
   */
  const sourceLocale =
    findLocaleFromMetadata(
      records,
      SOURCE_LOCALE_FIELDS,
    ) ??
    inferLocaleFromFieldName(
      schema.sourceField,
    )

  const translationLocale =
    findLocaleFromMetadata(
      records,
      TRANSLATION_LOCALE_FIELDS,
    ) ??
    inferLocaleFromFieldName(
      schema.translationField,
    )

  return {
    sourceLocale,
    translationLocale,

    sourceDirection:
      directionForLocale(
        sourceLocale,
      ),

    translationDirection:
      directionForLocale(
        translationLocale,
      ),
  }
}

function createUnknownLanguageInfo():
  LocalizationLanguageInfo {
  return {
    sourceDirection:
      'auto',

    translationDirection:
      'auto',
  }
}

function parseFlatObject(
  value:
    Record<string, unknown>,
  sourceText:
    string,
): ParsedLocalizationDocument | null {
  const entries =
    Object.entries(
      value,
    )
      .filter(
        isStringEntry,
      )

  if (
    entries.length === 0
  ) {
    return null
  }

  const totalFields =
    Object.keys(
      value,
    ).length

  const stringRatio =
    entries.length /
    Math.max(
      1,
      totalFields,
    )

  /*
   * إذا أقل من 70% من حقول
   * الـobject نصوص، غالبًا
   * هذا config وليس localization
   * flat object.
   */
  if (
    stringRatio < 0.7
  ) {
    return null
  }

  const parsedEntries:
    ParsedLocalizationEntry[] =
      entries.map(
        (
          [
            key,
            source,
          ],
          index,
        ) => ({
          id:
            `flat:${index}:${key}`,

          key,

          source,

          translation:
            '',

          keyPath:
            [
              key,
            ],

          sourcePath:
            [
              key,
            ],
        }),
      )

  /*
   * Flat JSON ما يعطينا
   * source/translation field names
   * يمكن استنتاج اللغة منها.
   *
   * لذلك ما نخمن.
   */
  return {
    parser:
      'json',

    format:
      'flat-json-object',

    sourceText,

    entries:
      parsedEntries,

    language:
      createUnknownLanguageInfo(),
  }
}

function parseRecordArray(
  value:
    unknown[],
  sourceText:
    string,
  characterDb?:
    CharacterDatabase,
): ParsedLocalizationDocument | null {
  const schema =
    detectRecordArraySchema(
      value,
    )

  if (!schema) {
    return null
  }

  const sampleRecords =
    getSampleRecords(
      value,
    )

  // Detect explicit structured-context fields (speaker/listener/gender/…)
  // so the Import UI can show a lightweight mapping review, and so each
  // entry carries its dialogue context.
  schema.contextFields =
    detectContextFields(
      sampleRecords,
    )

  const parsedEntries:
    ParsedLocalizationEntry[] = []

  value.forEach(
    (
      item,
      index,
    ) => {
      if (
        !isRecord(
          item,
        )
      ) {
        return
      }

      const rawKeyValue =
        schema.keyField
          ? item[
              schema.keyField
            ]
          : index

      const sourceValue =
        item[
          schema.sourceField
        ]

      const keyValue =
        scalarToString(
          rawKeyValue,
        ) ?? String(index)

      if (
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
              schema
                .contextField
            ]
          : undefined

      const notesValue =
        schema.notesField
          ? item[
              schema
                .notesField
            ]
          : undefined

      const context =
        scalarToString(
          contextValue,
        )

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

      const dialogueContext =
        detectDialogueContext(
          item,
          characterDb,
        )

      /*
       * index داخل id يضمن أن
       * entry_id المكرر في scenes
       * مختلفة ما يسبب collision.
       */
      const id =
        context
          ? `record:${index}:${context}:${keyValue}`
          : `record:${index}:${keyValue}`

      parsedEntries.push({
        id,

        key:
          keyValue,

        source:
          sourceValue,

        translation,

        context,
        notes,

        dialogueContext,

        keyPath:
          schema.keyField
            ? [
                index,
                schema.keyField,
              ]
            : [index],

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

  const language =
    detectLanguageInfo(
      sampleRecords,
      schema,
    )

  return {
    parser:
      'json',

    format:
      'json-record-array',

    sourceText,

    entries:
      parsedEntries,

    schema,

    language,
  }
}

/*
 * A top-level object shaped like:
 *
 *   { "characters": { "mark": { "name": "Mark", "gender": "male" } },
 *     "dialogue": [ { "speaker": "mark", "text": "..." } ] }
 *
 * (or `lines` / `entries` / `rows` / `texts`) is resolved by building the
 * character database and parsing the dialogue array with character resolution.
 * This preserves speaker→character ID→name/gender linkage explicitly present
 * in the file.
 */
function parseNestedDialogueObject(
  value:
    Record<string, unknown>,
  sourceText:
    string,
): ParsedLocalizationDocument | null {
  const characterDb =
    buildCharacterDatabase(
      value,
    )

  const arrayFieldNames = [
    'lines',
    'dialogue',
    'entries',
    'texts',
    'rows',
  ]

  for (
    const fieldName
    of arrayFieldNames
  ) {
    const candidate =
      value[fieldName]

    if (
      Array.isArray(
        candidate,
      )
    ) {
      const document =
        parseRecordArray(
          candidate,
          sourceText,
          characterDb,
        )

      if (
        document
      ) {
        return document
      }
    }
  }

  return null
}

export function parseJsonLocalization(
  text: string,
): LocalizationParseResult {
  let parsed:
    unknown

  try {
    parsed =
      parseLosslessJson(
        text,
      )
  } catch (error) {
    console.error(
      error,
    )

    return {
      ok:
        false,

      reason:
        'الملف ليس JSON صالحًا.',
    }
  }

  if (
    Array.isArray(
      parsed,
    )
  ) {
    const document =
      parseRecordArray(
        parsed,
        text,
      )

    if (
      document
    ) {
      return {
        ok:
          true,

        document,
      }
    }

    return {
      ok:
        false,

      reason:
        'تم التعرف على JSON Array، لكن لم نستطع تحديد حقول المفتاح والنص والترجمة تلقائيًا.',
    }
  }

  if (
    isRecord(
      parsed,
    )
  ) {
    const nestedDocument =
      parseNestedDialogueObject(
        parsed,
        text,
      )

    if (
      nestedDocument
    ) {
      return {
        ok:
          true,

        document:
          nestedDocument,
      }
    }

    const document =
      parseFlatObject(
        parsed,
        text,
      )

    if (
      document
    ) {
      return {
        ok:
          true,

        document,
      }
    }

    return {
      ok:
        false,

      reason:
        'تم التعرف على JSON Object، لكن بنيته ليست من الأنماط المدعومة حاليًا.',
    }
  }

  return {
    ok:
      false,

    reason:
      'بنية JSON غير مدعومة حاليًا.',
  }
}