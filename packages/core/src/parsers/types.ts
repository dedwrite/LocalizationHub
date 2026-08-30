export type JsonPathSegment =
  | string
  | number

export type LocalizationFileFormat =
  | 'flat-json-object'
  | 'json-record-array'
  | 'csv'
  | 'gettext-po'

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

/*
 * Structured dialogue context detected from an ordinary data file (JSON/CSV/PO).
 *
 * Every value is EXPLICITLY present in the source file — never inferred from
 * names, language, prose, or stereotypes. Unknown is absent (undefined), not
 * guessed. This is separate from the plain `context` string and carries the
 * richer speaker/listener/gender/scene/voice/portrait model the translators
 * need.
 *
 * `speaker`/`listener` hold the display name (or the raw id when a name is not
 * available); `speakerId`/`listenerId` hold the stable identifier when present.
 * Genders are normalized to the shared `GenderValue` vocabulary.
 */
export type ParsedDialogueContext = {
  speaker?: string
  speakerId?: string
  listener?: string
  listenerId?: string

  /*
   * Multiple listeners/targets (e.g. a line addressed to a group). Kept
   * alongside the single-listener form for compatibility — never forced into
   * one listener.
   */
  listeners?: string[]
  listenerIds?: string[]

  speakerGender?: string
  listenerGender?: string
  listenerGenders?: string[]
  speakerProvenance?: import('../extraction/types').FieldProvenance
  listenerProvenance?: import('../extraction/types').FieldProvenance
  speakerGenderProvenance?: import('../extraction/types').FieldProvenance
  listenerGenderProvenance?: import('../extraction/types').FieldProvenance

  /*
   * Explicit pronouns (e.g. "he/him", "she/her"). Never inferred.
   */
  speakerPronouns?: string
  listenerPronouns?: string

  scene?: string
  conversationId?: string
  dialogueId?: string
  nodeId?: string
  choiceGroup?: string

  voice?: string
  portrait?: string

  /*
   * Original (unnormalized) source values, preserved losslessly so a custom
   * schema's own gender vocabulary ("M"/"F", "masc"/"fem", numbers) survives.
   */
  raw?: Record<string, unknown>
}

export type ParsedLocalizationEntry = {
  id: string

  key: string
  source: string
  translation: string

  context?: string
  notes?: string

  /*
   * Structured dialogue context (speaker/listener/genders/scene/…). Optional
   * so older projects and simple key-value files stay compatible.
   */
  dialogueContext?: ParsedDialogueContext

  keyPath:
    JsonPathSegment[]

  sourcePath:
    JsonPathSegment[]

  translationPath?:
    JsonPathSegment[]
}

export type RecordArraySchema = {
  /*
   * The key field. Optional: a dialogue record array (e.g. `lines: [{ text,
   * speaker, ... }]`) may have no stable key, in which case the array index is
   * used as the key.
   */
  keyField?: string
  sourceField: string

  translationField?: string
  contextField?: string
  notesField?: string

  /*
   * Detected structured-context fields (speaker, listener, genders, …) with
   * confidence tiers, occurrence counts and sample values, for the Import
   * "Context Mapping" review.
   */
  contextFields?: Array<{ field: string; role: string; confidence?: string; occurrenceCount?: number; sampleValues?: string[] }>
}

export type ParsedLocalizationDocument = {
  parser: 'json' | 'csv' | 'gettext-po'

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
