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

/*
 * Extraction resource reads go through guarded native commands rather than
 * @tauri-apps/plugin-fs. The Tauri fs scope does NOT grant read access to the
 * OS temp directory where extraction jobs unpack, so plugin-fs reads of
 * %TEMP%\LocalizationHub\job-* are denied. The native reader (`read_extraction_text`
 * / `read_extraction_binary`) only accepts paths under an authorized root — an
 * active temp job dir (auto-authorized on creation) or a registered scan root.
 */
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
    readText: (absolutePath) => invoke<string>('read_extraction_text', { path: absolutePath }),
    readBinary: async (absolutePath) =>
      new Uint8Array(await invoke<number[]>('read_extraction_binary', { path: absolutePath })),
  }
}

/*
 * Register / unregister a user-selected scan root so loose resources (files the
 * user picked directly, outside any temp job dir) can be read by the guarded
 * native reader. Authorization should be dropped when the scan flow ends.
 */
export async function registerExtractionRoot(root: string): Promise<void> {
  await invoke('register_extraction_root', { root })
}

export async function unregisterExtractionRoot(root: string): Promise<void> {
  try {
    await invoke('unregister_extraction_root', { root })
  } catch {
    // Best-effort cleanup.
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
