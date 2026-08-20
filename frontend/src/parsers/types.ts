export type JsonPathSegment =
  | string
  | number

export type LocalizationFileFormat =
  | 'flat-json-object'
  | 'json-record-array'

export type ParsedLocalizationEntry = {
  id: string

  key: string
  source: string
  translation: string

  context?: string
  notes?: string

  keyPath: JsonPathSegment[]
  sourcePath: JsonPathSegment[]
  translationPath?: JsonPathSegment[]
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
  format: LocalizationFileFormat

  /*
   * نحفظ النص الأصلي كما هو حرفيًا.
   *
   * هذا مهم جدًا لأن الملف قد يحتوي
   * أرقام 64-bit أو metadata لا نريد
   * تغييرها أثناء الترجمة.
   */
  sourceText: string

  entries: ParsedLocalizationEntry[]

  schema?: RecordArraySchema
}

export type ParseSuccess = {
  ok: true
  document: ParsedLocalizationDocument
}

export type ParseFailure = {
  ok: false
  reason: string
}

export type LocalizationParseResult =
  | ParseSuccess
  | ParseFailure