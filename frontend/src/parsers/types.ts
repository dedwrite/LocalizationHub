export type JsonPathSegment =
  | string
  | number

export type LocalizationFileFormat =
  | 'flat-json-object'
  | 'json-record-array'

/*
 * اتجاه عرض النص.
 *
 * ltr:
 *   English / French / Spanish...
 *
 * rtl:
 *   Arabic / Hebrew / Persian...
 *
 * auto:
 *   لما ما نقدر نحدد اللغة
 *   بثقة من الملف.
 */
export type TextDirection =
  | 'ltr'
  | 'rtl'
  | 'auto'

/*
 * معلومات لغة المستند.
 *
 * هذه معلومات عرض / تحرير فقط.
 * لا تغيّر النص الأصلي ولا تدخل
 * أي Unicode direction markers
 * إلى الملف المصدر.
 *
 * Examples:
 *
 * text_en -> sourceLocale: en
 * text_ar -> translationLocale: ar
 *
 * sourceDirection: ltr
 * translationDirection: rtl
 */
export type LocalizationLanguageInfo = {
  sourceLocale?: string
  translationLocale?: string

  sourceDirection:
    TextDirection

  translationDirection:
    TextDirection
}

export type ParsedLocalizationEntry = {
  id: string

  key: string
  source: string
  translation: string

  context?: string
  notes?: string

  keyPath:
    JsonPathSegment[]

  sourcePath:
    JsonPathSegment[]

  translationPath?:
    JsonPathSegment[]
}

export type RecordArraySchema = {
  keyField: string
  sourceField: string

  translationField?: string
  contextField?: string
  notesField?: string
}

export type ParsedLocalizationDocument = {
  parser: 'json'

  format:
    LocalizationFileFormat

  /*
   * نحفظ النص الأصلي كما هو حرفيًا.
   *
   * هذا مهم جدًا لأن الملف قد يحتوي
   * أرقام 64-bit أو metadata لا نريد
   * تغييرها أثناء الترجمة.
   */
  sourceText: string

  entries:
    ParsedLocalizationEntry[]

  schema?:
    RecordArraySchema

  /*
   * معلومات اللغة والاتجاه.
   *
   * Optional حتى تبقى مشاريع
   * LocalizationHub القديمة متوافقة.
   *
   * الملفات الجديدة سيحاول الـparser
   * اكتشافها تلقائيًا.
   */
  language?:
    LocalizationLanguageInfo
}

export type ParseSuccess = {
  ok: true

  document:
    ParsedLocalizationDocument
}

export type ParseFailure = {
  ok: false

  reason: string
}

export type LocalizationParseResult =
  | ParseSuccess
  | ParseFailure