/*
 * Desktop extraction orchestrator.
 *
 * This is the layer that ties the native discovery/temp/process primitives to
 * the core parsers so "Scan Game" automatically handles engine archives:
 *
 *   discovered files
 *   → resolve configured tool (repak for .pak, retoc for .utoc)
 *   → unique temp dir
 *   → unpack
 *   → recursively discover extracted resources
 *   → remap temp paths to logical archive paths (pak::... / utoc::...)
 *   → core scanGame
 *   → cleanup
 *
 * No process execution happens inside React components; this module owns all
 * `invoke` calls and always cleans up temp dirs (success, failure, and cancel).
 */

import { invoke } from '@tauri-apps/api/core'
import { readFile, readTextFile } from '@tauri-apps/plugin-fs'
import {
  scanGame,
  type ScanFile,
  type ScanProgress,
  type ExtractionResult,
  type ContextFieldMapping,
} from '@localizationhub/core'
import { repakUnpackArgs, retocUnpackArgs } from './externalTool'

type ScannedFileResult = { path: string; size: number }
type ScanDiscovery = { files: ScannedFileResult[]; directories: string[] }
type ToolRunResult = { code: number; stdout: string; stderr: string; timed_out: boolean; output_truncated: boolean }

export type ToolPaths = {
  repak?: string
  retoc?: string
}

export type OrchestratorProgress = {
  phase: 'discovering' | 'extracting' | 'parsing' | 'done'
  message?: string
  scan?: ScanProgress
}

type ArchiveJob = {
  file: ScanFile
  kind: 'pak' | 'iostore'
  toolPath: string
  unpackArgs: (outDir: string) => string[]
}

function readTextAt(absolutePath: string): Promise<string> {
  return readTextFile(absolutePath)
}

function readBinaryAt(absolutePath: string): Promise<Uint8Array> {
  return readFile(absolutePath).then((buf) => new Uint8Array(buf))
}

export class DesktopExtractionError extends Error {
  readonly kind: string
  constructor(message: string, kind: string) {
    super(message)
    this.name = 'DesktopExtractionError'
    this.kind = kind
  }
}

/*
 * Resolve the configured tool path from local settings. Returns undefined when
 * not configured (the scan then reports a diagnostic rather than silently
 * skipping the archive).
 */
export function loadToolPaths(): ToolPaths {
  try {
    const raw = JSON.parse(localStorage.getItem('localizationhub.tools') ?? '{}') as Record<string, string>
    return { repak: raw['repak'], retoc: raw['retoc'] }
  } catch {
    return {}
  }
}

/*
 * Build a temp dir via the native command.
 */
async function createTempDir(): Promise<string> {
  const result = await invoke<{ path: string }>('create_temp_job_dir')
  return result.path
}

async function removeTempDir(path: string): Promise<void> {
  try {
    await invoke('remove_temp_dir', { path })
  } catch {
    // Cleanup is best-effort; never mask the real error.
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

/*
 * Main orchestrator. `looseFiles` are the discovered candidates; archives are
 * separated out, unpacked when a tool is configured, and their extracted
 * resources are re-discovered and remapped to logical archive paths.
 */
export async function runDesktopExtraction(
  discovery: { files: ScanFile[]; directories: string[] },
  tools: ToolPaths,
  options: {
    mappings?: ContextFieldMapping[]
    onProgress?: (progress: OrchestratorProgress) => void
    signal?: { cancelled: boolean }
  } = {},
): Promise<ExtractionResult> {
  const { files } = discovery
  const looseFiles: ScanFile[] = []
  const archiveJobs: ArchiveJob[] = []
  // Basenames (sans extension) of .utoc archives we will unpack. Their sibling
  // .ucas files are handled by retoc and must not be reported independently.
  const handledUtocBases = new Set<string>()
  for (const file of files) {
    const ext = extensionOf(file.name)
    if (ext === '.utoc' && tools.retoc) {
      handledUtocBases.add(file.name.slice(0, -ext.length))
    }
  }

  for (const file of files) {
    const ext = extensionOf(file.name)
    if (ext === '.pak' && tools.repak) {
      archiveJobs.push({
        file,
        kind: 'pak',
        toolPath: tools.repak,
        unpackArgs: (outDir) => repakUnpackArgs(file.absolutePath, outDir),
      })
    } else if (ext === '.utoc' && tools.retoc) {
      archiveJobs.push({
        file,
        kind: 'iostore',
        toolPath: tools.retoc,
        unpackArgs: (outDir) => retocUnpackArgs(file.absolutePath, outDir),
      })
    } else if (ext === '.ucas' && handledUtocBases.has(file.name.slice(0, -ext.length))) {
      // Companion container of a .utoc already being unpacked — skip it.
      continue
    } else {
      looseFiles.push(file)
    }
  }

  const allFiles: ScanFile[] = [...looseFiles]
  const tempDirs: string[] = []

  // Unpack each archive into an isolated temp dir and re-discover.
  for (const job of archiveJobs) {
    if (options.signal?.cancelled) break
    options.onProgress?.({ phase: 'extracting', message: `Extracting ${job.file.name}` })

    const tempDir = await createTempDir()
    tempDirs.push(tempDir)

    const args = job.unpackArgs(tempDir)
    const result = await invoke<ToolRunResult>('run_external_tool', {
      executable: job.toolPath,
      args,
      timeoutMs: 300_000,
    })

    if (result.timed_out) {
      throw new DesktopExtractionError(`${job.file.name} extraction timed out.`, 'timeout')
    }
    if (result.code !== 0) {
      throw new DesktopExtractionError(
        `${job.file.name} extraction failed (${job.kind}): ${(result.stderr || result.stdout).slice(0, 500)}`,
        'external-tool-failed',
      )
    }

    // Re-discover the extracted resources.
    const extracted = await invoke<ScanDiscovery>('scan_directory', { root: tempDir })
    const containerName = job.file.name
    for (const f of extracted.files) {
      // Remap the temp path to a logical archive path (never the temp dir).
      allFiles.push({
        name: f.path.split('/').pop() ?? f.path,
        relativePath: `${containerName}::${f.path}`,
        absolutePath: `${tempDir}/${f.path}`,
        size: f.size,
      })
    }
  }

  try {
    options.onProgress?.({ phase: 'parsing', message: 'Parsing resources' })

    const reader = {
      readText: (file: ScanFile) => readTextAt(file.absolutePath),
      readBinary: (file: ScanFile) => readBinaryAt(file.absolutePath),
    }

    const result = await scanGame({
      files: allFiles,
      directories: discovery.directories,
      reader,
      mappings: options.mappings,
      signal: options.signal,
      onProgress: (scan) => options.onProgress?.({ phase: 'parsing', scan }),
    })

    options.onProgress?.({ phase: 'done', message: 'Extraction complete' })
    return result
  } finally {
    // Clean up temp dirs after parsing, regardless of success/failure/cancel.
    await Promise.all(tempDirs.map((dir) => removeTempDir(dir)))
  }
}
