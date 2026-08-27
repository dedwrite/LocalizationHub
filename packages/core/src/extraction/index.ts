/*
 * LocalizationHub v0.7 — Game Text Extraction.
 *
 * Public API for engine-agnostic extraction, classification, protection, and
 * context intelligence. Engine adapters produce one normalized
 * `ExtractionResult`; the UI/Web/Cloud layers only ever see these types.
 */

export * from './types'
export * from './provenance'
export * from './classification'
export * from './contextInference'
export * from './conversationInference'
export * from './structuredData'
export * from './engineDetection'
export * from './extractionReview'
export { scanGame, type ScanFile, type FileReader, type ScanOptions, type ScanProgress } from './scanGame'
export { buildProjectFromExtraction } from './projectFromExtraction'
export { aggregateCultures, applyNativeCulture, overrideSourceCulture } from './cultureAggregation'
export {
  orchestrateExtraction,
  buildArchivePlan,
  OrchestrationError,
  type ExtractionPrimitives,
  type OrchestratorProgress,
  type OrchestratorOptions,
  type ArchiveJob,
  type ToolRunResult,
  type ScanDirectoryResult,
} from './orchestrate'
export {
  repakUnpackArgs,
  retocUnpackArgs,
  gdreExtractArgs,
  gdreBinToTxtArgs,
  unitypyExtractArgs,
  uassetdumperToJsonArgs,
  type ToolId,
  type ToolPaths,
} from './toolArgs'

export { extractGodot } from './engines/godot'
export { extractUnity, extractUnityStringTable, extractUnityStructuredJson } from './engines/unity'
export { extractUnrealText, extractUnrealLocres, extractUnrealLocmeta, detectEncryptedUnrealContainer } from './engines/unreal'
export { extractInk } from './engines/ink'
export { readLocres, isLocresBuffer, LOCRES_MAGIC, ELocResVersion, type LocResVersion } from './engines/locres'
export { readLocmeta, LOCMETA_MAGIC } from './engines/locmeta'
export { buildEntry, toProtectedSegments } from './engines/shared'
