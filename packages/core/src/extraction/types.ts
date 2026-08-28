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

/*
 * The audience a localization string is FOR, independent of its text
 * classification. Distinguishes player-facing runtime text from developer /
 * editor / test tooling so the review can exclude proven tooling by default
 * without deleting it.
 *
 *   runtime    player-facing game content (menus, dialogue, runtime UI)
 *   editor     Godot editor/plugin tooling (@tool, EditorPlugin, inspector UI)
 *   test       test/demo/sample/example fixtures
 *   debug      debug/development surfaces
 *   developer  other developer-only content
 *   unknown    could not be determined (treated as runtime for inclusion)
 */
export type ContentAudience =
  | 'runtime'
  | 'editor'
  | 'test'
  | 'debug'
  | 'developer'
  | 'unknown'

export const EXCLUDED_AUDIENCES: ReadonlySet<ContentAudience> = new Set([
  'editor',
  'test',
  'debug',
  'developer',
])

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
  | 'binary-resource-not-converted'
  | 'script-not-extracted'
  | 'ink-binary-not-parsed'
  | 'locale-structure-mismatch'
  | 'structural-skipped'
  | 'no-translatable-text'

export type ExtractionDiagnostic = {
  kind: ExtractionDiagnosticKind
  message: string
  path?: string
  /*
   * When a diagnostic represents many identical files, it is aggregated once
   * with a count and a bounded set of example paths instead of one card per
   * file. Extraction Review expands these into the examples on demand.
   */
  count?: number
  examplePaths?: string[]
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

  /*
   * Additional locale variants for the SAME logical localization identity
   * (e.g. a namespace/key present in multiple culture .locres files). This is
   * populated by the culture-aggregation layer so a multi-locale game produces
   * ONE entry per identity, not one duplicate per culture.
   */
  localeVariants?: Array<{ locale: string; text: string }>

  classification: EntryClassification
  classificationConfidence: Confidence

  context?: EntryContext

  origin: SourceLocator

  /*
   * Culture-independent identity used by the UNIVERSAL culture aggregation.
   * When set, entries sharing this identity (across locale resources) collapse
   * into ONE logical entry with `localeVariants`. Unreal uses
   * target/namespace/key; Godot JSON uses database + structural path; Godot
   * `.inkb` uses story path + line identity.
   */
  cultureIdentity?: string

  protectedSegments: ProtectedSegment[]
  protectionProfile: string

  /*
   * Content-audience classification (runtime vs editor/test/debug tooling).
   * Entries with an audience in `EXCLUDED_AUDIENCES` are auto-excluded from the
   * default project but remain in the review model and can be re-included.
   */
  contentAudience?: ContentAudience
  /*
   * Stable, human-readable reason for the auto-exclusion (e.g.
   * "godot-editor-plugin", "godot-tool-script", "test-resource").
   */
  exclusionReason?: string
  /* True when this entry is excluded from the default project by the audience
   * classifier (not by the user). */
  excludedByDefault?: boolean

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
  /*
   * Categorised resource counts so the UI can distinguish "88k resources
   * discovered" from "how many were actually localizable / convertible /
   * excluded".
   */
  resourcesDiscovered?: number
  resourcesAnalyzed?: number
  textResources?: number
  binaryResources?: number
  localizationResources?: number
  structuralResources?: number
  unsupportedResources?: number
  skipped?: number
  /*
   * Raw vs logical accounting for multi-locale aggregation: the number of
   * per-locale strings discovered BEFORE aggregation, and how many locale
   * variants were collapsed into logical entries. The review's primary
   * "Entries"/"Dialogue" counts are LOGICAL; these fields keep the useful
   * "we found N translations" fact visible.
   */
  rawLocalizedStrings?: number
  localizedVariants?: number
  /*
   * Audience-precision accounting: how many logical entries were auto-excluded
   * by default as proven editor/developer/test tooling, and how many were
   * classified runtime (included) vs uncertain.
   */
  developerExcluded?: number
  runtimeEntries?: number
  uncertainEntries?: number
}

export type ExtractionResult = {
  engine: EngineFamily
  detection: EngineDetection
  entries: ExtractedEntry[]
  diagnostics: ExtractionDiagnostic[]
  stats: ExtractionStats

  /*
   * Localization targets discovered during the scan (e.g. Unreal LOCMETA/LOCRES
   * targets with their native culture and available cultures). Used for
   * culture-aware aggregation and the Extraction Review culture controls.
   */
  localizationTargets?: LocalizationTarget[]

  /*
   * Optional wall-clock phase timings. Used for the objective "how long did
   * each phase take" reporting; never contains game text, paths, or secrets.
   */
  performance?: ExtractionPerformance
}

export type ExtractionPhaseTiming = {
  phase: string
  durationMs: number
}

export type ExtractionPerformance = {
  totalMs: number
  phases: ExtractionPhaseTiming[]
}

export type LocalizationTarget = {
  name: string
  nativeCulture?: string
  nativeLocRes?: string
  compiledCultures?: string[]
  availableCultures: string[]
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
