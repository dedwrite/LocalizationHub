/*
 * Game scan orchestration (engine-agnostic, read-only).
 *
 * Discovers candidate localization resources, detects the engine, dispatches
 * to the correct adapter, and aggregates a combined result. The orchestrator
 * is read-only by construction: it only receives a `read` callback and never
 * writes. Immutability of source files is guaranteed because no write path
 * exists.
 *
 * The file-source abstraction keeps this testable without Tauri and usable
 * from the desktop scan flow.
 */

import { detectEngine, type DetectionInput } from './engineDetection'
import { extractGodot } from './engines/godot'
import { extractUnity } from './engines/unity'
import { extractUnrealText, extractUnrealLocres, extractUnrealLocmeta } from './engines/unreal'
import { extractInk } from './engines/ink'
import { readLocmeta } from './engines/locmeta'
import { aggregateCultures, applyNativeCulture } from './cultureAggregation'
import type {
  EngineFamily,
  ExtractionDiagnostic,
  ExtractionResult,
  ExtractionStats,
} from './types'

export type ScanFile = {
  name: string
  /*
   * Project-relative provenance path (e.g. "Data/dialogue.json" or
   * "Game/Content/Localization/Game/en/Game.locres"). This is what flows into
   * `SourceLocator.containerPath` and project metadata. NEVER an absolute
   * filesystem path — it must not contain the user's drive, username, or root.
   */
  relativePath: string
  /*
   * Desktop runtime only: the absolute filesystem path used for IO. Never
   * serialized into normalized project metadata or SourceLocator.
   */
  absolutePath: string
  size: number
}

export type FileReader = {
  /*
   * Reads by ABSOLUTE path (desktop runtime IO). The returned content is then
   * parsed with the project-relative path as provenance.
   */
  readText: (file: ScanFile) => Promise<string>
  readBinary: (file: ScanFile) => Promise<Uint8Array>
}

export type ScanOptions = {
  files: ScanFile[]
  directories?: string[]
  reader: FileReader
  mappings?: Array<{ fieldName: string; role: any }>
  onProgress?: (progress: ScanProgress) => void
  signal?: { cancelled: boolean }
}

export type ScanProgress = {
  filesDiscovered: number
  filesAnalyzed: number
  candidateFiles: number
  entriesFound: number
  phase: 'discovering' | 'analyzing' | 'done'
}

const TEXT_EXTENSIONS = new Set(['.json', '.csv', '.po', '.pot', '.tscn', '.tres', '.scn', '.txt', '.ink', '.gd'])
const BINARY_EXTENSIONS = new Set(['.locres', '.locmeta'])
const ARCHIVE_EXTENSIONS = new Set(['.pak', '.utoc', '.ucas', '.pck', '.assets', '.unity3d', '.res'])

// Extensionless Unity serialized files are discovered by exact/pattern name.
const EXTENSIONLESS_NAMES = new Set(['globalgamemanagers', 'globalgamemanagers.assets', 'data.unity3d', 'level0', 'projectsettings', 'unitydefaultresources'])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return ''
  return name.slice(dot).toLowerCase()
}

function isCandidate(file: ScanFile): boolean {
  const lower = file.name.toLowerCase()
  if (EXTENSIONLESS_NAMES.has(lower)) return true
  if (lower.startsWith('level') && !lower.includes('.')) return true
  if (lower.startsWith('sharedassets') && lower.endsWith('.assets')) return true

  const ext = extensionOf(file.name)
  return (
    TEXT_EXTENSIONS.has(ext) ||
    BINARY_EXTENSIONS.has(ext) ||
    ARCHIVE_EXTENSIONS.has(ext)
  )
}

function combineStats(parts: ExtractionStats[]): ExtractionStats {
  const combined: ExtractionStats = {
    filesScanned: parts.reduce((sum, p) => sum + p.filesScanned, 0),
    candidateFiles: parts.reduce((sum, p) => sum + p.candidateFiles, 0),
    entriesFound: parts.reduce((sum, p) => sum + p.entriesFound, 0),
    byClassification: {},
    protectedTokenCount: parts.reduce((sum, p) => sum + p.protectedTokenCount, 0),
    entriesWithSpeaker: parts.reduce((sum, p) => sum + p.entriesWithSpeaker, 0),
    entriesWithListener: parts.reduce((sum, p) => sum + p.entriesWithListener, 0),
    entriesWithExplicitGender: parts.reduce((sum, p) => sum + p.entriesWithExplicitGender, 0),
    entriesWithInferredContext: parts.reduce((sum, p) => sum + p.entriesWithInferredContext, 0),
    conversationGroups: parts.reduce((sum, p) => sum + p.conversationGroups, 0),
    warnings: parts.reduce((sum, p) => sum + p.warnings, 0),
    errors: parts.reduce((sum, p) => sum + p.errors, 0),
  }
  for (const part of parts) {
    for (const [classification, count] of Object.entries(part.byClassification)) {
      combined.byClassification[classification as keyof typeof combined.byClassification] =
        (combined.byClassification[classification as keyof typeof combined.byClassification] ?? 0) + (count ?? 0)
    }
  }
  return combined
}

export async function scanGame(options: ScanOptions): Promise<ExtractionResult> {
  const { files, reader, mappings, signal, directories } = options

  const detectionInput: DetectionInput = {
    files: files.map((file) => ({ name: file.name, lower: file.name.toLowerCase() })),
    directories: (directories ?? []).map((dir) => ({ name: dir, lower: dir.toLowerCase() })),
  }
  const detection = detectEngine(detectionInput)

  const candidates = files.filter(isCandidate)
  const diagnostics: ExtractionDiagnostic[] = []
  const entries: ExtractionResult['entries'] = []
  const statsParts: ExtractionStats[] = []
  // Native-culture metadata collected from .locmeta files (target → native culture).
  const nativeByTarget = new Map<string, string>()

  let filesAnalyzed = 0
  options.onProgress?.({
    filesDiscovered: files.length,
    filesAnalyzed: 0,
    candidateFiles: candidates.length,
    entriesFound: 0,
    phase: 'analyzing',
  })

  for (const file of candidates) {
    if (signal?.cancelled) {
      diagnostics.push({ kind: 'cancelled', message: 'Scan cancelled.', path: file.relativePath })
      break
    }

    const ext = extensionOf(file.name)
    let result: ExtractionResult

    try {
      if (TEXT_EXTENSIONS.has(ext)) {
        const text = await reader.readText(file)
        result = dispatchText(file, text, detection.engine, mappings)
      } else if (ext === '.locres') {
        const buffer = await reader.readBinary(file)
        result = extractUnrealLocres({ fileName: file.relativePath, buffer })
      } else if (ext === '.locmeta') {
        // LOCMETA is metadata only; capture native culture for aggregation.
        const buffer = await reader.readBinary(file)
        const meta = readLocmeta(buffer)
        if (meta.nativeCulture && meta.nativeLocRes) {
          nativeByTarget.set(meta.nativeLocRes, meta.nativeCulture)
        }
        result = extractUnrealLocmeta({ fileName: file.relativePath, buffer })
      } else if (ARCHIVE_EXTENSIONS.has(ext)) {
        // Archives are delegated to external tooling; record a diagnostic so
        // the review can report them honestly rather than ignoring them.
        result = {
          engine: detection.engine,
          detection,
          entries: [],
          diagnostics: [{ kind: 'external-tool-not-found', message: `Archive ${file.relativePath} requires external unpacking.`, path: file.relativePath }],
          stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
        }
      } else {
        continue
      }
    } catch (error) {
      result = {
        engine: detection.engine,
        detection,
        entries: [],
        diagnostics: [{ kind: 'parser-error', message: error instanceof Error ? error.message : 'Parser error.', path: file.relativePath }],
        stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
      }
    }

    entries.push(...result.entries)
    diagnostics.push(...result.diagnostics)
    statsParts.push(result.stats)
    filesAnalyzed += 1

    options.onProgress?.({
      filesDiscovered: files.length,
      filesAnalyzed,
      candidateFiles: candidates.length,
      entriesFound: entries.length,
      phase: 'analyzing',
    })
  }

  options.onProgress?.({
    filesDiscovered: files.length,
    filesAnalyzed,
    candidateFiles: candidates.length,
    entriesFound: entries.length,
    phase: 'done',
  })

  const stats = combineStats(statsParts)
  stats.filesScanned = files.length
  stats.candidateFiles = candidates.length

  // Culture aggregation: collapse duplicate per-culture entries into one
  // logical entry per localization identity, using LOCMETA native culture.
  const aggregated = aggregateCultures(entries)
  const withNative = applyNativeCulture(aggregated, nativeByTarget)
  stats.entriesFound = withNative.entries.length

  return {
    engine: detection.engine,
    detection,
    entries: withNative.entries,
    diagnostics,
    stats,
    localizationTargets: withNative.targets,
  }
}

function dispatchText(
  file: ScanFile,
  text: string,
  engine: EngineFamily,
  mappings?: Array<{ fieldName: string; role: any }>,
): ExtractionResult {
  const ext = extensionOf(file.name)
  const name = file.relativePath

  if (engine === 'unreal') return extractUnrealText({ fileName: name, text, mappings })
  if (engine === 'godot') return extractGodot({ fileName: name, text, mappings })
  if (engine === 'unity') return extractUnity({ fileName: name, text, mappings })
  if (engine === 'ink' || ext === '.ink') return extractInk({ fileName: name, text })

  // Engine-specific dispatch fallback when detection is generic:
  if (ext === '.tscn' || ext === '.tres' || ext === '.scn' || ext === '.gd' || ext === '.pck') {
    return extractGodot({ fileName: name, text, mappings })
  }
  if (ext === '.json' || ext === '.csv') {
    // Heuristic: if it looks like a Unity String Table (has Table + Locale), use Unity.
    if (ext === '.json') {
      try {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object' && ('Table' in parsed || 'SharedTableData' in parsed)) {
          return extractUnity({ fileName: name, text, mappings })
        }
      } catch {
        // fall through to structured
      }
    }
    return extractGodot({ fileName: name, text, mappings })
  }
  return extractGodot({ fileName: name, text, mappings })
}
