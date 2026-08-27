/*
 * Universal extraction model for LocalizationHub v0.7.
 *
 * Every engine adapter (Unreal / Godot / Unity) produces the SAME normalized
 * `ExtractionResult`. Engine-specific parsing never leaks into the UI, the
 * Web editor, or Cloud project data — only these normalized types do.
 *
 * Fields that an engine does not provide are simply omitted. "Unknown" is a
 * valid classification and a valid confidence level.
 */

export type EngineFamily =
  | 'unreal'
  | 'godot'
  | 'unity'
  | 'ink'
  | 'generic'

export type Confidence =
  | 'high'
  | 'medium'
  | 'low'

export type ProvenanceKind =
  | 'explicit-engine'
  | 'explicit-field'
  | 'schema-map'
  | 'structural-inference'
  | 'heuristic'
  | 'user-mapped'
  | 'unknown'

export type EntryClassification =
  | 'Dialogue'
  | 'Subtitle'
  | 'UI'
  | 'Menu'
  | 'Tutorial'
  | 'Quest'
  | 'Objective'
  | 'ItemName'
  | 'ItemDescription'
  | 'CharacterName'
  | 'LocationName'
  | 'Choice'
  | 'SystemMessage'
  | 'Notification'
  | 'Codex'
  | 'Achievement'
  | 'Metadata'
  | 'Identifier'
  | 'Path'
  | 'Unknown'
  | 'NonTranslatable'

export type GenderValue =
  | 'male'
  | 'female'
  | 'neutral'
  | 'unknown'
  | 'custom'

export type ExtractionDiagnosticKind =
  | 'unsupported-format'
  | 'unsupported-engine-version'
  | 'encrypted-container'
  | 'missing-key'
  | 'corrupt-resource'
  | 'missing-companion-file'
  | 'missing-type-tree'
  | 'external-tool-not-found'
  | 'external-tool-failed'
  | 'parser-error'
  | 'partial-extraction'
  | 'low-confidence'
  | 'cancelled'

export type ExtractionDiagnostic = {
  kind: ExtractionDiagnosticKind
  message: string
  path?: string
}

/*
 * A protected (non-translatable) segment inside a source string: a format
 * placeholder, a tag, a variable, a control code, an engine macro, etc.
 */
export type ProtectedSegment = {
  raw: string
  kind: string
  start: number
  end: number
  ruleId: string
}

/*
 * Provenance for a single inferred contextual field. Inferred data is always
 * labelled so it is never presented as guaranteed engine metadata.
 */
export type FieldProvenance = {
  source: ProvenanceKind
  confidence: Confidence
}

export type EntryContext = {
  speaker?: string
  listener?: string
  listeners?: string[]
  speakerGender?: GenderValue
  listenerGender?: GenderValue
  listenerGenders?: GenderValue[]
  grammaticalGender?: GenderValue
  grammaticalNumber?: 'singular' | 'plural' | 'unknown'
  characterId?: string
  speakerId?: string
  listenerId?: string
  scene?: string
  conversationId?: string
  dialogueId?: string
  nodeId?: string
  parentNodeId?: string
  previousEntryId?: string
  nextEntryId?: string
  choiceGroup?: string
  voiceId?: string
  audioAsset?: string
  portrait?: string
  animationCue?: string
  developerNote?: string
  translatorNote?: string
  contextText?: string

  // Provenance for the most important inferred fields.
  speakerProvenance?: FieldProvenance
  listenerProvenance?: FieldProvenance
  speakerGenderProvenance?: FieldProvenance
  listenerGenderProvenance?: FieldProvenance
  classificationProvenance?: FieldProvenance
  conversationProvenance?: FieldProvenance
}

/*
 * Where a string came from. This is retained for source traceability and is
 * project-relative (never an absolute Windows path) when serialized to Cloud.
 */
export type SourceLocator = {
  engine: EngineFamily
  engineVersion?: string
  containerPath?: string
  internalAssetPath?: string
  resourceName?: string
  objectType?: string
  fieldPath?: string
  table?: string
  row?: string
  column?: string
  namespace?: string
  key?: string
  objectId?: string
  bundleName?: string
  archiveEntry?: string
}

export type ExtractedEntry = {
  /*
   * Stable extraction ID, unique within one extraction result. Prefer an
   * engine-native identity when available; otherwise derive one that is stable
   * for the same source across runs.
   */
  id: string

  /*
   * Engine-native key. Distinct from `id`; this is the localization key or
   * table key when the engine has one.
   */
  key?: string

  /*
   * Localization namespace / table collection when present.
   */
  namespace?: string

  /*
   * Original order (0-based) so entries can be restored to source order.
   */
  order: number

  sourceText: string
  sourceLocale?: string
  existingTranslation?: string
  pluralVariants?: Array<{ quantity: string; text: string }>

  classification: EntryClassification
  classificationConfidence: Confidence

  context?: EntryContext

  origin: SourceLocator

  protectedSegments: ProtectedSegment[]
  protectionProfile: string

  /*
   * Safe structured information preserved losslessly (engine-specific but
   * non-secret, already-normalized). Never includes raw binary blobs, paths to
   * private user directories, or keys.
   */
  rawMetadata?: Record<string, unknown>
}

export type ExtractionSource = {
  path: string
  kind: 'file' | 'folder' | 'archive' | 'executable' | 'resource-directory'
  engine?: EngineFamily
  confidence?: Confidence
  evidence?: string[]
}

export type EngineDetection = {
  engine: EngineFamily
  familyLabel: string
  versionEstimate?: string
  confidence: Confidence
  evidence: string[]
}

export type ExtractionStats = {
  filesScanned: number
  candidateFiles: number
  entriesFound: number
  byClassification: Partial<Record<EntryClassification, number>>
  protectedTokenCount: number
  entriesWithSpeaker: number
  entriesWithListener: number
  entriesWithExplicitGender: number
  entriesWithInferredContext: number
  conversationGroups: number
  warnings: number
  errors: number
}

export type ExtractionResult = {
  engine: EngineFamily
  detection: EngineDetection
  entries: ExtractedEntry[]
  diagnostics: ExtractionDiagnostic[]
  stats: ExtractionStats
}

/*
 * Optional project metadata carrying extraction provenance/context into a
 * LocalizationHub Project V3 (backward-compatible: absent for non-extracted
 * projects). Keyed by entry id. Origin paths are project-relative, never
 * absolute user filesystem paths.
 */
export type ExtractionEngineInfo = {
  engine: EngineFamily
  familyLabel: string
  confidence: Confidence
  entries: Record<
    string,
    {
      context?: EntryContext
      origin: SourceLocator
      classification: EntryClassification
      classificationConfidence: Confidence
    }
  >
}
