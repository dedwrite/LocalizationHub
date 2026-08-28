/*
 * Node/Vitest extraction harness.
 *
 * Provides the SAME ExtractionPrimitives contract that the desktop Tauri
 * binding supplies, but backed by node:child_process and node:fs, so the pure
 * orchestration in @localizationhub/core runs against REAL game archives with
 * REAL external tools (repak / retoc / gdre / UnityPy helper / UAssetDumper).
 *
 * This is a DEV-ONLY harness: it is never shipped in the app bundle and it
 * never hardcodes a private tool path. Tool/sample paths are injected via
 * environment variables (or a caller-provided map).
 */

import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { ExtractionPrimitives, ScanFile, ToolPaths } from '@localizationhub/core'

const execFileAsync = promisify(execFile)

export function sha256File(filePath: string): Promise<string> {
  return crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex').toUpperCase()
}

/*
 * Mirrors the Rust `scan_directory` + `run_external_tool` + temp-dir commands
 * with bounded output and timeout kill, matching the desktop contract.
 */
export function createNodePrimitives(): ExtractionPrimitives {
  const runTool: ExtractionPrimitives['runTool'] = async (executable, args, timeoutMs = 300_000) => {
    try {
      const { stdout, stderr } = await execFileAsync(executable, args, {
        timeout: timeoutMs,
        maxBuffer: 1_000_000,
        windowsHide: true,
        encoding: 'utf8',
      })
      return { code: 0, stdout, stderr, timed_out: false, output_truncated: false }
    } catch (err) {
      const e = err as { killed?: boolean; code?: number | string; stdout?: string; stderr?: string }
      if (e.killed) {
        return { code: -1, stdout: '', stderr: '', timed_out: true, output_truncated: false }
      }
      const code = typeof e.code === 'number' ? e.code : -1
      return {
        code,
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? '',
        timed_out: false,
        output_truncated: false,
      }
    }
  }

  const scanDirectory: ExtractionPrimitives['scanDirectory'] = async (root) => {
    const files: Array<{ path: string; size: number }> = []
    const directories: string[] = []

    async function walk(current: string) {
      const entries = await fs.readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) {
          const rel = path.relative(root, full).replaceAll('\\', '/')
          directories.push(rel)
          await walk(full)
        } else if (entry.isFile()) {
          const rel = path.relative(root, full).replaceAll('\\', '/')
          const size = (await fs.stat(full)).size
          files.push({ path: rel, size })
        }
      }
    }
    await walk(root)

    files.sort((a, b) => a.path.localeCompare(b.path))
    directories.sort()
    return { files, directories }
  }

  return {
    runTool,
    createTempDir: () => fs.mkdtemp(path.join(os.tmpdir(), 'lhub-')),
    removeTempDir: async (dir) => {
      await fs.rm(dir, { recursive: true, force: true })
    },
    scanDirectory,
    readText: (p) => fs.readFile(p, 'utf8'),
    readBinary: (p) => fs.readFile(p),
    copyFile: (src, dst) => fs.copyFile(src, dst),
  }
}

/*
 * Build normalized ScanFiles from a real input path (a single file, or a
 * directory whose contents are discovered). relativePath is the safe
 * provenance; absolutePath is the real filesystem location for IO.
 */
export async function discoverInput(rootOrFile: string): Promise<{ files: ScanFile[]; directories: string[] }> {
  const stat = await fs.stat(rootOrFile)
  if (stat.isFile()) {
    const name = path.basename(rootOrFile)
    return {
      files: [{ name, relativePath: name, absolutePath: path.resolve(rootOrFile), size: stat.size }],
      directories: [],
    }
  }

  const root = path.resolve(rootOrFile)
  const { files, directories } = await createNodePrimitives().scanDirectory(root)
  const scanFiles: ScanFile[] = files.map((f) => ({
    name: f.path.split('/').pop() ?? f.path,
    relativePath: f.path,
    absolutePath: path.join(root, f.path),
    size: f.size,
  }))
  return { files: scanFiles, directories }
}

/*
 * Load tool paths from env var LH_TOOLS (JSON) or an explicit map.
 */
export function loadToolsFromEnv(): ToolPaths {
  const raw = process.env.LH_TOOLS
  if (!raw) return {}
  try {
    return JSON.parse(raw) as ToolPaths
  } catch {
    return {}
  }
}
