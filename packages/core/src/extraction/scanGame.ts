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
import { extractGodot, extractGodotScript } from './engines/godot'
import { extractPo } from './engines/gettext'
import { extractUnity } from './engines/unity'
import { extractUnrealText, extractUnrealLocres, extractUnrealLocmeta } from './engines/unreal'
import { extractInk } from './engines/ink'
import { extractInkb } from './engines/inkb'
import { readLocmeta } from './engines/locmeta'
import { aggregateCultures, applyNativeCulture, inferNativeCultures } from './cultureAggregation'
import type {
  EngineFamily,
  ExtractionDiagnostic,
  ExtractionResult,
  ExtractionStats,
  ExtractionPhaseTiming,
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

/*
 * A single batched-read result, keyed by the file's absolute path. Errors are
 * per-file (one bad/unauthorized file never aborts the batch).
 */
export type BatchTextRead = { path: string; text?: string; error?: string }
export type BatchBinaryRead = { path: string; data?: Uint8Array; error?: string }

export type FileReader = {
  /*
   * Reads by ABSOLUTE path (desktop runtime IO). The returned content is then
   * parsed with the project-relative path as provenance.
   */
  readText: (file: ScanFile) => Promise<string>
  readBinary: (file: ScanFile) => Promise<Uint8Array>
  /*
   * Optional batched equivalents. When present, scanGame reads files in
   * bounded chunks (one native call per chunk) instead of one invoke per file,
   * avoiding tens of thousands of IPC round-trips on large games.
   */
  readTextBatch?: (files: ScanFile[]) => Promise<BatchTextRead[]>
  readBinaryBatch?: (files: ScanFile[]) => Promise<BatchBinaryRead[]>
}

export type ScanOptions = {
  files: ScanFile[]
  directories?: string[]
  reader: FileReader
  mappings?: Array<{ fieldName: string; role: any }>
  onProgress?: (progress: ScanProgress) => void
  signal?: { cancelled: boolean }
  /*
   * Optional engine-family override from the orchestrator. When the caller has
   * already unpacked an engine archive (e.g. a Unity .bundle whose extracted
   * resources are extensionless/JSON), it supplies the engine it KNOWS is
   * present so text is dispatched to the correct adapter.
   */
  engineHint?: EngineFamily
}

export type ScanProgress = {
  filesDiscovered: number
  filesAnalyzed: number
  candidateFiles: number
  entriesFound: number
  phase: 'discovering' | 'analyzing' | 'done'
  /* Human-readable sub-phase (Reading resources / Aggregating languages / …). */
  message?: string
  /*
   * Categorized resource accounting so the UI can distinguish "88k resources
   * discovered" from "how many were actually localizable text / story /
   * binary / excluded". `candidateFiles` remains the count of files that will
   * actually be read and parsed.
   */
  textCandidates?: number
  storyCandidates?: number
  binaryCandidates?: number
  excluded?: number
}

/*
 * Engine-resource classification. Each discovered file is routed into exactly
 * one bucket so binary resources are NEVER mistaken for UTF-8 text and
 * unsupported resources are reported once (aggregated) rather than once per
 * file.
 */
export type ResourceKind =
  | 'text-resource'      // UTF-8 parseable (JSON/CSV/PO/tscn/tres/txt/ink/gd)
  | 'script'             // GDScript source (.gd) — safe, targeted extraction
  | 'unreal-binary'      // .locres/.locmeta — native readers
  | 'godot-binary'       // .res/.scn/.translation/.gdc — requires conversion
  | 'inkb-story'         // Until Then .inkb story (native reader)
  | 'archive'            // .pak/.utoc/.ucas/.pck/.assets/.unity3d/.bundle
  | 'structural'         // .import/.remap/.godot/.uid/.md5 sidecar — never text
  | 'unknown'            // not localizable, skipped silently

export const TEXT_EXTENSIONS = new Set(['.json', '.csv', '.po', '.pot', '.tscn', '.tres', '.txt', '.ink'])
export const SCRIPT_EXTENSIONS = new Set(['.gd'])
export const UNREAL_BINARY_EXTENSIONS = new Set(['.locres', '.locmeta'])
export const GODOT_BINARY_RESOURCE_EXTENSIONS = new Set(['.res', '.scn', '.translation', '.gdc'])
export const INKB_STORY_EXTENSIONS = new Set(['.inkb'])
export const ARCHIVE_EXTENSIONS = new Set(['.pak', '.utoc', '.ucas', '.pck', '.assets', '.unity3d', '.bundle'])
export const STRUCTURAL_EXTENSIONS = new Set(['.import', '.remap', '.godot', '.uid', '.md5', '.meta', '.cfg'])

// Extensionless Unity serialized files are discovered by exact/pattern name.
export const EXTENSIONLESS_NAMES = new Set(['globalgamemanagers', 'globalgamemanagers.assets', 'data.unity3d', 'level0', 'projectsettings', 'unitydefaultresources'])

/*
 * Every extension that a PARSER can act on (not "unknown"/"structural"). These
 * MUST be discoverable by the native `scan_directory` command
 * (src-tauri/src/scan.rs CANDIDATE_EXTENSIONS / EXTENSIONLESS_CANDIDATE_NAMES),
 * otherwise the desktop scan silently drops localizable content. This is the
 * canonical list the discovery-parity tests (Rust + Vitest) enforce.
 */
export const CORE_ROUTEABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  ...TEXT_EXTENSIONS,
  ...SCRIPT_EXTENSIONS,
  ...UNREAL_BINARY_EXTENSIONS,
  ...GODOT_BINARY_RESOURCE_EXTENSIONS,
  ...INKB_STORY_EXTENSIONS,
  ...ARCHIVE_EXTENSIONS,
  // Archive jobs handled by orchestrate.ts buildArchivePlan (never parseable
  // directly, but discovered so they can be routed to an external tool).
  '.uasset', '.uexp', '.ubulk',
])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return ''
  return name.slice(dot).toLowerCase()
}

/*
 * Classify a file by extension. `.scn` is ambiguous (Godot text scenes are
 * `.tscn`, binary scenes are `.scn`), so a magic-byte check is performed for it
 * at dispatch time — never a blind UTF-8 read.
 */
export function classifyFileKind(file: ScanFile): ResourceKind {
  const lower = file.name.toLowerCase()
  if (EXTENSIONLESS_NAMES.has(lower)) return 'archive'
  if (lower.startsWith('level') && !lower.includes('.')) return 'archive'
  if (lower.startsWith('sharedassets') && lower.endsWith('.assets')) return 'archive'

  const ext = extensionOf(file.name)
  if (TEXT_EXTENSIONS.has(ext)) return 'text-resource'
  if (SCRIPT_EXTENSIONS.has(ext)) return 'script'
  if (UNREAL_BINARY_EXTENSIONS.has(ext)) return 'unreal-binary'
  if (GODOT_BINARY_RESOURCE_EXTENSIONS.has(ext)) return 'godot-binary'
  if (INKB_STORY_EXTENSIONS.has(ext)) return 'inkb-story'
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'archive'
  if (STRUCTURAL_EXTENSIONS.has(ext)) return 'structural'
  return 'unknown'
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

/*
 * Number of files read in a single chunk. Large enough to collapse ~87k text
 * resources into ~340 native batch calls, small enough to bound the IPC
 * payload and memory peak. Keep in sync with the Rust MAX_BATCH_SIZE.
 */
const READ_CHUNK_SIZE = 256

/*
 * Yield to the event loop so a long scan never wedges the UI (Windows "Not
 * Responding"). `setTimeout(0)` schedules a macrotask, which lets the browser
 * render between chunks.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/*
 * Bounded-concurrency map. Used as the fallback when a reader has no batched
 * primitive (e.g. the Node harness), and never as an unbounded `Promise.all`.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index])
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function readTextChunk(
  reader: FileReader,
  files: ScanFile[],
): Promise<Map<string, BatchTextRead>> {
  const map = new Map<string, BatchTextRead>()
  if (files.length === 0) return map
  if (reader.readTextBatch) {
    for (const result of await reader.readTextBatch(files)) map.set(result.path, result)
    return map
  }
  await mapWithConcurrency(files, 16, async (file) => {
    try {
      map.set(file.absolutePath, { path: file.absolutePath, text: await reader.readText(file) })
    } catch (error) {
      map.set(file.absolutePath, {
        path: file.absolutePath,
        error: error instanceof Error ? error.message : 'Read error.',
      })
    }
  })
  return map
}

async function readBinaryChunk(
  reader: FileReader,
  files: ScanFile[],
): Promise<Map<string, BatchBinaryRead>> {
  const map = new Map<string, BatchBinaryRead>()
  if (files.length === 0) return map
  if (reader.readBinaryBatch) {
    for (const result of await reader.readBinaryBatch(files)) map.set(result.path, result)
    return map
  }
  await mapWithConcurrency(files, 16, async (file) => {
    try {
      map.set(file.absolutePath, { path: file.absolutePath, data: await reader.readBinary(file) })
    } catch (error) {
      map.set(file.absolutePath, {
        path: file.absolutePath,
        error: error instanceof Error ? error.message : 'Read error.',
      })
    }
  })
  return map
}

function parseTextResource(
  file: ScanFile,
  text: string,
  engine: EngineFamily,
  mappings?: Array<{ fieldName: string; role: any }>,
): ExtractionResult {
  const ext = extensionOf(file.name)
  if (ext === '.po' || ext === '.pot') return extractPo(file.relativePath, text)
  return dispatchText(file, text, engine, mappings)
}

function parseUnrealBinary(
  file: ScanFile,
  buffer: Uint8Array,
  nativeByTarget: Map<string, string>,
): ExtractionResult {
  if (extensionOf(file.name) === '.locres') {
    return extractUnrealLocres({ fileName: file.relativePath, buffer })
  }
  // LOCMETA is metadata only; capture native culture for aggregation.
  const meta = readLocmeta(buffer)
  if (meta.nativeCulture && meta.nativeLocRes) {
    nativeByTarget.set(meta.nativeLocRes, meta.nativeCulture)
  }
  return extractUnrealLocmeta({ fileName: file.relativePath, buffer })
}

function parserErrorResult(
  detection: ExtractionResult['detection'],
  file: ScanFile,
  error: unknown,
): ExtractionResult {
  return {
    engine: detection.engine,
    detection,
    entries: [],
    diagnostics: [{ kind: 'parser-error', message: error instanceof Error ? error.message : 'Parser error.', path: file.relativePath }],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
  }
}

export async function scanGame(options: ScanOptions): Promise<ExtractionResult> {
  const { files, reader, mappings, signal, directories } = options
  const totalStarted = Date.now()
  const phases: ExtractionPhaseTiming[] = []
  const markPhase = (phase: string, started: number) => {
    phases.push({ phase, durationMs: Date.now() - started })
  }

  const detectionInput: DetectionInput = {
    files: files.map((file) => ({ name: file.name, lower: file.name.toLowerCase() })),
    directories: (directories ?? []).map((dir) => ({ name: dir, lower: dir.toLowerCase() })),
  }
  let detection = detectEngine(detectionInput)
  if (options.engineHint) {
    detection = { ...detection, engine: options.engineHint }
  }

  const diagnostics: ExtractionDiagnostic[] = []
  const entries: ExtractionResult['entries'] = []
  const statsParts: ExtractionStats[] = []
  // Native-culture metadata collected from .locmeta files (target → native culture).
  const nativeByTarget = new Map<string, string>()

  // Resource-kind accounting so the UI can distinguish resources from text.
  const kindCounts: Record<ResourceKind, number> = {
    'text-resource': 0,
    script: 0,
    'unreal-binary': 0,
    'godot-binary': 0,
    'inkb-story': 0,
    archive: 0,
    structural: 0,
    unknown: 0,
  }
  const archivePaths: string[] = []
  const godotBinaryPaths: string[] = []

  // --- Phase 1: classify (no IO). Route every file into exactly one bucket so
  // binary resources are never mistaken for UTF-8 text and containers are
  // reported once (aggregated). Only "actionable" files are read+parsed. ---
  const classifyStarted = Date.now()
  const actionable: Array<{ file: ScanFile; kind: ResourceKind }> = []
  for (const file of files) {
    const kind = classifyFileKind(file)
    kindCounts[kind] += 1
    if (kind === 'archive') {
      if (archivePaths.length < 5) archivePaths.push(file.relativePath)
      continue
    }
    if (kind === 'godot-binary') {
      if (godotBinaryPaths.length < 5) godotBinaryPaths.push(file.relativePath)
      continue
    }
    if (kind === 'unknown' || kind === 'structural') continue
    actionable.push({ file, kind })
  }
  markPhase('classify', classifyStarted)

  // Categorized accounting: "candidate" = a file that will actually be read and
  // parsed, not every discovered resource.
  const candidateFiles = actionable.length
  const textCandidates = kindCounts['text-resource'] + kindCounts.script
  const storyCandidates = kindCounts['inkb-story']
  const binaryCandidates = kindCounts['unreal-binary'] + kindCounts['godot-binary']
  const excluded = kindCounts.structural + kindCounts.unknown

  let filesAnalyzed = 0
  const emitProgress = (phase: ScanProgress['phase'], message?: string) => {
    options.onProgress?.({
      filesDiscovered: files.length,
      filesAnalyzed,
      candidateFiles,
      entriesFound: entries.length,
      phase,
      message,
      textCandidates,
      storyCandidates,
      binaryCandidates,
      excluded,
    })
  }
  emitProgress('analyzing', 'Reading resources')

  // --- Phase 2: chunked read + parse. Bounded chunks + batched native reads
  // (one invoke per chunk, not per file) + a yield between chunks so a large
  // scan never wedges the UI ("Not Responding"). ---
  const readParseStarted = Date.now()
  for (let index = 0; index < actionable.length; index += READ_CHUNK_SIZE) {
    if (signal?.cancelled) {
      diagnostics.push({ kind: 'cancelled', message: 'Scan cancelled.', path: actionable[index]?.file.relativePath })
      break
    }
    // Yield to the event loop so the UI can paint between chunks.
    await yieldToEventLoop()

    const chunk = actionable.slice(index, index + READ_CHUNK_SIZE)
    const textFiles = chunk
      .filter((item) => item.kind === 'text-resource' || item.kind === 'script')
      .map((item) => item.file)
    const binaryFiles = chunk
      .filter((item) => item.kind === 'inkb-story' || item.kind === 'unreal-binary')
      .map((item) => item.file)

    const [textMap, binaryMap] = await Promise.all([
      readTextChunk(reader, textFiles),
      readBinaryChunk(reader, binaryFiles),
    ])

    for (const { file, kind } of chunk) {
      if (signal?.cancelled) break
      let result: ExtractionResult
      try {
        if (kind === 'text-resource' || kind === 'script') {
          const read = textMap.get(file.absolutePath)
          if (!read || read.error) throw new Error(read?.error ?? 'Read error.')
          if (kind === 'script') {
            result = extractGodotScript(file.relativePath, read.text ?? '')
          } else {
            result = parseTextResource(file, read.text ?? '', detection.engine, mappings)
          }
        } else if (kind === 'inkb-story') {
          const read = binaryMap.get(file.absolutePath)
          if (!read || read.error) throw new Error(read?.error ?? 'Read error.')
          result = extractInkb(file.relativePath, read.data ?? new Uint8Array(0))
          if (result.entries.length === 0) {
            result = {
              ...result,
              diagnostics: [{ kind: 'unsupported-format', message: 'Unrecognized .inkb story format (not an Until Then story).', path: file.relativePath }],
            }
          }
        } else if (kind === 'unreal-binary') {
          const read = binaryMap.get(file.absolutePath)
          if (!read || read.error) throw new Error(read?.error ?? 'Read error.')
          result = parseUnrealBinary(file, read.data ?? new Uint8Array(0), nativeByTarget)
        } else {
          continue
        }
      } catch (error) {
        result = parserErrorResult(detection, file, error)
      }

      entries.push(...result.entries)
      diagnostics.push(...result.diagnostics)
      statsParts.push(result.stats)
      filesAnalyzed += 1
    }

    emitProgress('analyzing', 'Reading resources')
  }
  markPhase('read-and-parse', readParseStarted)

  emitProgress('analyzing', 'Aggregating languages')

  // --- Aggregated diagnostics (one card per class, not per file) ---
  if (archivePaths.length > 0) {
    diagnostics.push({
      kind: 'external-tool-not-found',
      message: 'Archive containers require external unpacking.',
      count: kindCounts.archive,
      examplePaths: archivePaths,
    })
  }
  if (godotBinaryPaths.length > 0) {
    diagnostics.push({
      kind: 'binary-resource-not-converted',
      message: 'Binary Godot resources (.res/.scn/.translation/.gdc) require conversion.',
      count: kindCounts['godot-binary'],
      examplePaths: godotBinaryPaths,
    })
  }

  // --- Aggregate repeated diagnostics so 88k files become a handful of cards. ---
  const aggregatedDiagnostics = aggregateDiagnostics(diagnostics)

  const stats = combineStats(statsParts)
  stats.filesScanned = files.length
  stats.candidateFiles = candidateFiles
  stats.resourcesDiscovered = files.length
  stats.resourcesAnalyzed = filesAnalyzed
  stats.textResources = kindCounts['text-resource']
  stats.binaryResources = kindCounts['godot-binary'] + kindCounts['unreal-binary']
  stats.localizationResources = kindCounts['text-resource']
  stats.structuralResources = kindCounts.structural
  stats.unsupportedResources = kindCounts.archive + kindCounts['godot-binary']
  stats.skipped = kindCounts.structural + kindCounts.unknown

  // Culture aggregation: collapse duplicate per-culture entries into one
  // logical entry per localization identity (inkb stories are line-aligned;
  // JSON DBs / Unreal use identity grouping), then apply LOCMETA native culture.
  const aggregateStarted = Date.now()
  const aggregated = aggregateCultures(entries)
  const withNative = applyNativeCulture(aggregated, nativeByTarget)
  // Infer each target's native/source culture from explicit base-content
  // evidence (Godot unsuffixed base) so the review never falls back to the
  // first locale alphabetically.
  const targets = inferNativeCultures(withNative.entries, withNative.targets)
  markPhase('aggregate-and-align', aggregateStarted)
  stats.entriesFound = withNative.entries.length
  // Raw vs logical accounting: how many per-locale strings were discovered,
  // and how many locale variants were collapsed into logical entries.
  stats.rawLocalizedStrings = entries.length
  stats.localizedVariants = withNative.entries.reduce((sum, e) => sum + (e.localeVariants?.length ?? 0), 0)

  // Recompute the classification/context stats from the LOGICAL entries so the
  // review shows one entry per identity, not N per locale.
  stats.byClassification = {}
  for (const entry of withNative.entries) {
    stats.byClassification[entry.classification] = (stats.byClassification[entry.classification] ?? 0) + 1
  }
  stats.protectedTokenCount = withNative.entries.reduce((sum, e) => sum + e.protectedSegments.length, 0)
  stats.entriesWithSpeaker = withNative.entries.filter((e) => e.context?.speaker).length
  stats.entriesWithListener = withNative.entries.filter((e) => e.context?.listener || e.context?.listeners?.length).length
  stats.entriesWithExplicitGender = withNative.entries.filter((e) => e.context?.speakerGender && e.context.speakerGender !== 'unknown').length
  stats.entriesWithInferredContext = withNative.entries.filter((e) => e.context?.speaker || e.context?.scene || e.context?.conversationId).length
  stats.conversationGroups = withNative.entries.filter((e) => e.context?.conversationId).reduce((acc, e) => {
    const id = e.context?.conversationId ?? ''
    acc.add(id)
    return acc
  }, new Set<string>()).size

  // --- Cross-locale structural mismatch diagnostic -----------------------
  // Reported per story from the line-level alignment: how many base lines had
  // no overlay counterpart and how many overlay lines were isolated.
  const mismatches = aggregated.mismatchStories
  if (mismatches.length > 0) {
    aggregatedDiagnostics.push({
      kind: 'locale-structure-mismatch',
      message: 'Some story locale copies diverge in line structure; matching lines were merged and divergent lines were kept isolated.',
      count: mismatches.length,
      examplePaths: mismatches.slice(0, 5).map((m) => `${m.storyPath} (${m.locales.join(', ')})`),
    })
  }

  // --- Zero-entry safety: a scan with thousands of resources and no text is
  // not a successful scan; surface it prominently. ---
  if (withNative.entries.length === 0 && files.length > 0) {
    aggregatedDiagnostics.push({
      kind: 'no-translatable-text',
      message: 'No translatable text was extracted from this game.',
      count: 1,
    })
  }

  emitProgress('done', 'Preparing review')

  return {
    engine: detection.engine,
    detection,
    entries: withNative.entries,
    diagnostics: aggregatedDiagnostics,
    stats,
    localizationTargets: targets,
    performance: {
      totalMs: Date.now() - totalStarted,
      phases,
    },
  }
}

/*
 * Collapse repeated diagnostics by (kind + message) into a single card with a
 * count and a bounded set of example paths. Single occurrences are left as-is.
 */
function aggregateDiagnostics(diagnostics: ExtractionDiagnostic[]): ExtractionDiagnostic[] {
  const byKey = new Map<string, ExtractionDiagnostic>()
  const order: string[] = []
  for (const d of diagnostics) {
    const key = `${d.kind}\u0000${d.message}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        kind: d.kind,
        message: d.message,
        path: d.path,
        count: d.count ?? 1,
        examplePaths: d.examplePaths ?? (d.path ? [d.path] : []),
      })
      order.push(key)
    } else {
      existing.count = (existing.count ?? 1) + (d.count ?? 1)
      if (d.path && (existing.examplePaths?.length ?? 0) < 5) {
        existing.examplePaths = [...(existing.examplePaths ?? []), d.path]
      }
    }
  }
  return order.map((key) => byKey.get(key) as ExtractionDiagnostic)
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
