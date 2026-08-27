/*
 * Convert an ExtractionResult into a LocalizationHub Project V3.
 *
 * The project stores the normalized entries (source/translation/key) plus an
 * optional `metadata.extraction` payload carrying context, provenance,
 * classification, and project-relative origin for every entry. This keeps
 * extraction metadata backward-compatible: non-extracted projects simply omit
 * the field, and Web translators can display context/provenance without any
 * engine parser.
 */

import type {
  LocalizationProjectV3,
} from '../projectModel'
import type {
  ParsedLocalizationEntry,
} from '../parsers'
import { emptyProjectMetadata } from '../projectMetadata'
import type {
  ExtractedEntry,
  ExtractionEngineInfo,
  ExtractionResult,
} from './types'

function toParsedEntry(entry: ExtractedEntry): ParsedLocalizationEntry {
  return {
    id: entry.id,
    key: entry.key ?? entry.id,
    source: entry.sourceText,
    translation: entry.existingTranslation ?? '',
    keyPath: [entry.key ?? entry.id],
    sourcePath: [entry.origin.internalAssetPath ?? entry.origin.key ?? entry.id],
  }
}

export function buildProjectFromExtraction(
  result: ExtractionResult,
  sourceFileName: string,
): LocalizationProjectV3 {
  const entries = result.entries.map(toParsedEntry)

  const extractionInfo: ExtractionEngineInfo = {
    engine: result.engine,
    familyLabel: result.detection.familyLabel,
    confidence: result.detection.confidence,
    entries: {},
  }

  for (const entry of result.entries) {
    extractionInfo.entries[entry.id] = {
      context: entry.context,
      origin: entry.origin,
      classification: entry.classification,
      classificationConfidence: entry.classificationConfidence,
    }
  }

  return {
    format: 'LocalizationHubProject',
    version: 3,
    sourceFileName,
    selectedEntryId: entries[0]?.id ?? null,
    tokenProfile: result.engine === 'unreal' ? 'unreal' : result.engine === 'unity' ? 'unity' : result.engine === 'godot' ? 'godot' : 'generic',
    document: {
      parser: 'json',
      format: 'flat-json-object',
      sourceText: '{}',
    },
    entries,
    workflow: { entries: {} },
    metadata: {
      ...emptyProjectMetadata(),
      extraction: extractionInfo,
    },
  }
}
