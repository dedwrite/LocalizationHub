/*
 * Desktop extraction orchestrator (Tauri binding).
 *
 * This is a thin adapter that supplies Tauri primitives (invoke / plugin-fs)
 * to the shared, pure orchestration in @localizationhub/core. The pipeline
 * itself (archive plan → unpack → re-discover → remap → scanGame → cleanup)
 * lives in core so the Node/Vitest integration harness exercises the IDENTICAL
 * logic against real game archives.
 */

import { invoke } from '@tauri-apps/api/core'
import { readFile, readTextFile } from '@tauri-apps/plugin-fs'
import {
  orchestrateExtraction,
  type ExtractionPrimitives,
  type OrchestratorProgress,
  type ScanFile,
  type ExtractionResult,
  type ContextFieldMapping,
  type ToolPaths,
} from '@localizationhub/core'

type ScannedFileResult = { path: string; size: number }
type ScanDiscovery = { files: ScannedFileResult[]; directories: string[] }
type ToolRunResult = { code: number; stdout: string; stderr: string; timed_out: boolean; output_truncated: boolean }

export type { ToolPaths }

function buildPrimitives(): ExtractionPrimitives {
  return {
    runTool: (executable, args, timeoutMs) =>
      invoke<ToolRunResult>('run_external_tool', { executable, args, timeoutMs }),
    createTempDir: async () => (await invoke<{ path: string }>('create_temp_job_dir')).path,
    removeTempDir: async (path) => {
      try {
        await invoke('remove_temp_dir', { path })
      } catch {
        // Cleanup is best-effort; never mask the real error.
      }
    },
    scanDirectory: (root) => invoke<ScanDiscovery>('scan_directory', { root }),
    readText: (absolutePath) => readTextFile(absolutePath),
    readBinary: async (absolutePath) => new Uint8Array(await readFile(absolutePath)),
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
    return {
      repak: raw['repak'],
      retoc: raw['retoc'],
      gdre: raw['gdre'],
      unitypy: raw['unitypy'],
      unitypyScript: raw['unitypyScript'],
      uassetdumper: raw['uassetdumper'],
    }
  } catch {
    return {}
  }
}

/*
 * Run the shared extraction pipeline with Tauri primitives.
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
  return orchestrateExtraction(discovery, tools, buildPrimitives(), options)
}
