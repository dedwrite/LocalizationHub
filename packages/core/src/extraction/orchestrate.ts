/*
 * Engine-agnostic extraction orchestrator (pure, injectable primitives).
 *
 * This is the SAME orchestration used by the desktop "Scan Game" flow and by
 * the Node/Vitest integration harness. It is pure: every side effect (process
 * execution, temp dirs, file IO) is injected, so the identical logic runs in
 * the Tauri desktop (invoke/plugin-fs primitives) and in Node (child_process /
 * fs primitives) against real game archives.
 *
 * Pipeline:
 *   discovered files
 *   → build an archive plan (which tool unpacks which container)
 *   → unpack each archive into an isolated temp dir
 *   → re-discover / derive parseable resources
 *   → remap temp paths to logical archive paths (pak::…, pck::…, etc.)
 *   → core scanGame
 *   → cleanup
 */

import { scanGame, type ScanFile, type ScanProgress, type BatchTextRead, type BatchBinaryRead } from './scanGame'
import type { ExtractionResult, EngineFamily, ExtractionDiagnostic } from './types'
import type { ContextFieldMapping } from './contextInference'
import {
  gdreExtractArgs,
  gdreBinToTxtArgs,
  gdreDecompileArgs,
  repakUnpackArgs,
  retocUnpackArgs,
  uassetdumperToJsonArgs,
  unitypyExtractArgs,
  type ToolId,
  type ToolPaths,
} from './toolArgs'

export type ToolRunResult = {
  code: number
  stdout: string
  stderr: string
  timed_out: boolean
  output_truncated: boolean
}

export type ScanDirectoryResult = {
  files: Array<{ path: string; size: number }>
  directories: string[]
}

export type ExtractionPrimitives = {
  runTool: (executable: string, args: string[], timeoutMs?: number) => Promise<ToolRunResult>
  createTempDir: () => Promise<string>
  removeTempDir: (path: string) => Promise<void>
  scanDirectory: (root: string) => Promise<ScanDirectoryResult>
  readText: (absolutePath: string) => Promise<string>
  readBinary: (absolutePath: string) => Promise<Uint8Array>
  /*
   * Guarded file copy for the derived-copy conversion pipeline. Both src and
   * dst must be inside authorized roots (scan root / active temp job dir), so
   * the original source is never modified.
   */
  copyFile?: (src: string, dst: string) => Promise<void>
  /*
   * Optional guarded BATCH reads. When present, scanGame reads files in bounded
   * chunks (one native call per chunk) instead of one invoke per file — this
   * avoids tens of thousands of IPC round-trips on large games. Every path is
   * still authorized/canonicalized by the native command; errors are per-file.
   */
  readTextBatch?: (absolutePaths: string[]) => Promise<BatchTextRead[]>
  readBinaryBatch?: (absolutePaths: string[]) => Promise<BatchBinaryRead[]>
}

export type OrchestratorProgress = {
  phase: 'discovering' | 'extracting' | 'parsing' | 'done'
  message?: string
  scan?: ScanProgress
}

export type OrchestratorOptions = {
  mappings?: ContextFieldMapping[]
  onProgress?: (progress: OrchestratorProgress) => void
  signal?: { cancelled: boolean }
  /* Per-tool timeout in milliseconds. */
  toolTimeoutMs?: number
  /*
   * User-provided AES key for encrypted archives. Passed to repak/retoc/GDRE
   * as an explicit argument only; never logged, persisted, or uploaded.
   */
  aesKey?: string
}

export class OrchestrationError extends Error {
  readonly kind: string
  constructor(message: string, kind: string) {
    super(message)
    this.name = 'OrchestrationError'
    this.kind = kind
  }
}

export type ArchiveJob = {
  file: ScanFile
  kind: 'pak' | 'iostore' | 'pck' | 'unity' | 'uasset' | 'godot-binary'
  toolId: ToolId
  executable: string
  buildArgs: (outDir: string, aesKey?: string) => string[]
  /*
   * For `godot-binary`: the target extension to re-emit converted output under
   * so it routes to the correct text parser (.scn → .tscn, .res → .tres,
   * .gdc → .gd).
   */
  convertTo?: string
}

/*
 * Classify an external-tool failure from its stderr/stdout so we emit an
 * accurate diagnostic instead of a generic "tool failed":
 *
 *   - encrypted-container      — AES/encryption signature (never brute-forced)
 *   - unsupported-engine-version — serialization/version header mismatch
 *   - external-tool-failed     — anything else
 */
export function classifyToolFailure(
  kind: ArchiveJob['kind'],
  stderr: string,
  stdout: string,
): ExtractionDiagnostic['kind'] {
  const output = `${stderr}\n${stdout}`.toLowerCase()
  if (
    /aes|encrypt|decrypt|invalid key|crypto|wrong key|bad key/iu.test(output) ||
    // repak/retoc report an encrypted/unsupported footer or unknown magic.
    /(invalid|unknown|unsupported) (aes|footer|encryption|magic)/iu.test(output)
  ) {
    return 'encrypted-container'
  }
  if (
    /(unsupported|unknown|invalid|mismatched) (asset|serialization|package|engine)? ?version/iu.test(output) ||
    /version (header|mismatch)|serialization version|ue5|unreal engine 5/iu.test(output)
  ) {
    return 'unsupported-engine-version'
  }
  if (kind === 'uasset') {
    // A UAssetDumper failure is a version/format limitation unless it was an
    // encryption error above.
    return /version|header|read|parse|deserialize/iu.test(output)
      ? 'unsupported-engine-version'
      : 'external-tool-failed'
  }
  return 'external-tool-failed'
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

const UNITY_ARCHIVE_EXTENSIONS = new Set(['.bundle', '.unity3d'])

/*
 * Infer the engine family from the archive jobs the plan produced, so text
 * extracted from an unpacked archive is dispatched to the correct adapter even
 * when the extracted resources themselves are extensionless or generic JSON.
 */
function engineHintFor(jobs: ArchiveJob[]): EngineFamily | undefined {
  const counts = { unreal: 0, godot: 0, unity: 0 }
  for (const job of jobs) {
    if (job.kind === 'pak' || job.kind === 'iostore' || job.kind === 'uasset') counts.unreal += 1
    else if (job.kind === 'pck' || job.kind === 'godot-binary') counts.godot += 1
    else if (job.kind === 'unity') counts.unity += 1
  }
  const best = (Object.entries(counts) as Array<[EngineFamily, number]>).reduce((a, b) => (b[1] > a[1] ? b : a))
  return best[1] > 0 ? best[0] : undefined
}

/*
 * Classify discovered files into loose (directly parseable) files and archive
 * jobs (files that must be unpacked/derived through an external tool first).
 * The plan is pure and deterministic.
 */
export function buildArchivePlan(files: ScanFile[], tools: ToolPaths): { looseFiles: ScanFile[]; jobs: ArchiveJob[] } {
  const looseFiles: ScanFile[] = []
  const jobs: ArchiveJob[] = []
  // Basenames (sans extension) of .utoc archives we will unpack: their sibling
  // .ucas containers are handled by retoc and must not be reported twice.
  const handledUtocBases = new Set<string>()
  // Basenames of .uasset files we will convert: their .uexp/.ubulk companions
  // are read by UAssetAPI automatically and must not be reported separately.
  const handledUassetBases = new Set<string>()

  for (const file of files) {
    const ext = extensionOf(file.name)
    if (ext === '.utoc' && tools.retoc) handledUtocBases.add(file.name.slice(0, -ext.length))
    if (ext === '.uasset' && tools.uassetdumper) handledUassetBases.add(file.name.slice(0, -ext.length))
  }

  for (const file of files) {
    const ext = extensionOf(file.name)
    if (ext === '.pak' && tools.repak) {
      jobs.push({
        file,
        kind: 'pak',
        toolId: 'repak',
        executable: tools.repak,
        buildArgs: (outDir, aesKey) => repakUnpackArgs(file.absolutePath, outDir, aesKey),
      })
    } else if (ext === '.utoc' && tools.retoc) {
      jobs.push({
        file,
        kind: 'iostore',
        toolId: 'retoc',
        executable: tools.retoc,
        buildArgs: (outDir, aesKey) => retocUnpackArgs(file.absolutePath, outDir, aesKey),
      })
    } else if (ext === '.ucas' && handledUtocBases.has(file.name.slice(0, -ext.length))) {
      // Companion container of a .utoc already being unpacked — skip it.
      continue
    } else if (ext === '.pck' && tools.gdre) {
      jobs.push({
        file,
        kind: 'pck',
        toolId: 'gdre',
        executable: tools.gdre,
        buildArgs: (outDir, aesKey) => gdreExtractArgs(file.absolutePath, outDir, aesKey),
      })
    } else if ((ext === '.res' || ext === '.scn') && tools.gdre) {
      // Binary Godot resource → GDRE --bin-to-txt on a TEMP COPY (read-only-safe;
      // the original is never modified). Output re-emitted as text .tres/.tscn.
      jobs.push({
        file,
        kind: 'godot-binary',
        toolId: 'gdre',
        executable: tools.gdre,
        buildArgs: (outDir) => gdreBinToTxtArgs(`${outDir}/${file.name}`, outDir),
        convertTo: ext === '.scn' ? '.tscn' : '.tres',
      })
    } else if (ext === '.gdc' && tools.gdre) {
      // GDScript bytecode → GDRE --decompile on a TEMP COPY.
      jobs.push({
        file,
        kind: 'godot-binary',
        toolId: 'gdre',
        executable: tools.gdre,
        buildArgs: (outDir) => gdreDecompileArgs(`${outDir}/${file.name}`, outDir),
        convertTo: '.gd',
      })
    } else if ((UNITY_ARCHIVE_EXTENSIONS.has(ext) || ext === '.assets') && tools.unitypy) {
      jobs.push({
        file,
        kind: 'unity',
        toolId: 'unitypy',
        executable: tools.unitypy as string,
        buildArgs: (outDir) => unitypyExtractArgs(tools.unitypyScript as string, file.absolutePath, outDir),
      })
    } else if (ext === '.uasset' && tools.uassetdumper) {
      jobs.push({
        file,
        kind: 'uasset',
        toolId: 'uassetdumper',
        executable: tools.uassetdumper,
        buildArgs: (outDir) => uassetdumperToJsonArgs(file.absolutePath, `${outDir}/${file.name}.json`),
      })
    } else if ((ext === '.uexp' || ext === '.ubulk') && handledUassetBases.has(file.name.slice(0, -ext.length))) {
      // Companion of a .uasset already being converted — skip it.
      continue
    } else {
      looseFiles.push(file)
    }
  }

  return { looseFiles, jobs }
}

/*
 * Run the full pipeline. `discovery.files` are already-normalized ScanFiles
 * (relativePath = safe provenance, absolutePath = runtime IO).
 */
export async function orchestrateExtraction(
  discovery: { files: ScanFile[]; directories: string[] },
  tools: ToolPaths,
  primitives: ExtractionPrimitives,
  options: OrchestratorOptions = {},
): Promise<ExtractionResult> {
  const { looseFiles, jobs } = buildArchivePlan(discovery.files, tools)

  const allFiles: ScanFile[] = [...looseFiles]
  const tempDirs: string[] = []
  const jobDiagnostics: ExtractionDiagnostic[] = []
  const timeoutMs = options.toolTimeoutMs ?? 300_000
  const totalStarted = Date.now()
  let archiveExtractionMs = 0

  for (const job of jobs) {
    if (options.signal?.cancelled) break
    options.onProgress?.({ phase: 'extracting', message: `Extracting ${job.file.name}` })

    const jobStarted = Date.now()
    const tempDir = await primitives.createTempDir()
    tempDirs.push(tempDir)

    // Derived-copy pipeline for binary Godot resources: copy the original into
    // the temp job dir, then convert the COPY (never the original). Proven
    // read-only-safe (GDRE --bin-to-txt writes to --output, leaving input
    // untouched).
    if (job.kind === 'godot-binary') {
      if (!primitives.copyFile) {
        jobDiagnostics.push({ kind: 'binary-resource-not-converted', message: `Binary Godot resource ${job.file.name} requires a copy primitive to convert safely.`, path: job.file.relativePath })
        continue
      }
      try {
        await primitives.copyFile(job.file.absolutePath, `${tempDir}/${job.file.name}`)
      } catch (error) {
        jobDiagnostics.push({ kind: 'binary-resource-not-converted', message: `Could not copy ${job.file.name} for conversion: ${error instanceof Error ? error.message : 'copy failed'}.`, path: job.file.relativePath })
        continue
      }
    }

    const args = job.buildArgs(tempDir, options.aesKey)
    const result = await primitives.runTool(job.executable, args, timeoutMs)

    if (result.timed_out) {
      jobDiagnostics.push({ kind: 'external-tool-failed', message: `${job.file.name} extraction timed out.`, path: job.file.relativePath })
      continue
    }
    if (result.code !== 0) {
      // Classify the failure (encrypted / unsupported version / generic) so the
      // user gets an accurate, actionable diagnostic — and isolate it so one
      // bad archive never aborts the whole scan.
      const failureKind = classifyToolFailure(job.kind, result.stderr, result.stdout)
      const message = failureKind === 'encrypted-container'
        ? `${job.file.name} is an encrypted ${job.kind} archive; provide the AES key to extract it.`
        : failureKind === 'unsupported-engine-version'
          ? `${job.file.name} uses an unsupported engine/asset serialization version (${job.kind}).`
          : `${job.file.name} extraction failed (${job.kind}): ${(result.stderr || result.stdout).slice(0, 300)}`
      jobDiagnostics.push({ kind: failureKind, message, path: job.file.relativePath })
      continue
    }

    // Collect the parseable resources this job produced.
    if (job.kind === 'uasset') {
      // UAssetDumper writes exactly one JSON next to the (single) input.
      allFiles.push({
        name: `${job.file.name}.json`,
        relativePath: `${job.file.relativePath}.json`,
        absolutePath: `${tempDir}/${job.file.name}.json`,
        size: 0,
      })
      continue
    }

    if (job.kind === 'godot-binary') {
      // Converted output: GDRE writes the text form into the temp dir under the
      // original name (e.g. binary .scn → text .scn). Re-emit it under the text
      // extension so it routes to the Godot text parser.
      const convertedName = `${job.file.name}`
      const remappedName = job.convertTo
        ? convertedName.replace(/\.[^.]*$/, job.convertTo)
        : convertedName
      // GDRE writes the converted file under --output (nested) or beside the
      // input; discover it.
      const discovered = await primitives.scanDirectory(tempDir)
      const convertedRel = discovered.files.map((f) => f.path).find((p) => p.includes(convertedName))
      allFiles.push({
        name: remappedName.split('/').pop() ?? remappedName,
        relativePath: `${job.file.relativePath}::converted/${remappedName}`,
        absolutePath: `${tempDir}/${convertedRel ?? convertedName}`,
        size: 0,
      })
      continue
    }

    // Unpack tools (repak/retoc/gdre/unitypy): re-discover the temp dir.
    const extracted = await primitives.scanDirectory(tempDir)
    const containerName = job.file.name
    for (const f of extracted.files) {
      allFiles.push({
        name: f.path.split('/').pop() ?? f.path,
        relativePath: `${containerName}::${f.path}`,
        absolutePath: `${tempDir}/${f.path}`,
        size: f.size,
      })
    }
    archiveExtractionMs += Date.now() - jobStarted
  }

  try {
    options.onProgress?.({ phase: 'parsing', message: 'Parsing resources' })

    const reader = {
      readText: (file: ScanFile) => primitives.readText(file.absolutePath),
      readBinary: (file: ScanFile) => primitives.readBinary(file.absolutePath),
      readTextBatch: primitives.readTextBatch
        ? (files: ScanFile[]) => primitives.readTextBatch!(files.map((file) => file.absolutePath))
        : undefined,
      readBinaryBatch: primitives.readBinaryBatch
        ? (files: ScanFile[]) => primitives.readBinaryBatch!(files.map((file) => file.absolutePath))
        : undefined,
    }

    const result = await scanGame({
      files: allFiles,
      directories: discovery.directories,
      reader,
      mappings: options.mappings,
      signal: options.signal,
      engineHint: engineHintFor(jobs),
      onProgress: (scan) => options.onProgress?.({ phase: 'parsing', scan }),
    })

    options.onProgress?.({ phase: 'done', message: 'Extraction complete' })

    // Prepend the archive-extraction phase to scanGame's phase timings and
    // rebase the total to cover the whole pipeline.
    const phases: Array<{ phase: string; durationMs: number }> = []
    if (archiveExtractionMs > 0) phases.push({ phase: 'archive-extraction', durationMs: archiveExtractionMs })
    if (result.performance) phases.push(...result.performance.phases)
    return {
      ...result,
      // Isolated archive-tool failures (encrypted/version/generic) are merged
      // into the diagnostics without aborting the scan.
      diagnostics: [...jobDiagnostics, ...result.diagnostics],
      performance: {
        totalMs: Date.now() - totalStarted,
        phases,
      },
    }
  } finally {
    // Clean up temp dirs after parsing, regardless of success/failure/cancel.
    await Promise.all(tempDirs.map((dir) => primitives.removeTempDir(dir)))
  }
}
