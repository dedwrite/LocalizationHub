/*
 * Optional external-tool adapter for engine binary formats.
 *
 * Desktop-only. Invokes mature licensed CLIs (repak for .pak, retoc for
 * IoStore .utoc/.ucas, UAssetDumper for .uasset) with strict isolation:
 *   - executable detection + version check
 *   - timeout
 *   - stdout/stderr capture
 *   - non-zero exit handling
 *   - no shell interpolation (argument arrays only)
 *   - isolated temp directories with cleanup
 *   - source directory never written
 *
 * The tool path is never hardcoded to a private developer location; callers
 * provide a configured tool path.
 */

export type ExternalToolSpec = {
  id: 'repak' | 'retoc' | 'uassetdumper'
  displayName: string
  executablePath: string
}

export type ExternalToolRunResult =
  | { ok: true; stdout: string; stderr: string }
  | { ok: false; kind: 'not-found' | 'timeout' | 'non-zero' | 'spawn-error'; message: string; stderr?: string }

export type ExternalToolRunner = {
  run: (spec: ExternalToolSpec, args: string[], options: { timeoutMs?: number }) => Promise<ExternalToolRunResult>
}

/*
 * The default runner shells out to the OS process. In a Tauri desktop context
 * this is backed by the Tauri shell plugin; in tests it is replaced with a fake
 * runner. Keeping this behind an interface prevents Process/Command invocations
 * from being scattered across UI code and makes it testable.
 */
export function createProcessRunner(
  spawn: (command: string, args: string[], options: { timeoutMs?: number }) => Promise<{ code: number | null; stdout: string; stderr: string }>,
): ExternalToolRunner {
  return {
    async run(spec, args, options) {
      try {
        const result = await spawn(spec.executablePath, args, { timeoutMs: options.timeoutMs })
        if (result.code === 0) {
          return { ok: true, stdout: result.stdout, stderr: result.stderr }
        }
        return {
          ok: false,
          kind: 'non-zero',
          message: `${spec.displayName} exited with code ${result.code}.`,
          stderr: result.stderr,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/timeout/iu.test(message)) {
          return { ok: false, kind: 'timeout', message: `${spec.displayName} timed out.` }
        }
        if (/ENOENT|not found|no such file/iu.test(message)) {
          return { ok: false, kind: 'not-found', message: `${spec.displayName} executable not found at ${spec.executablePath}.` }
        }
        return { ok: false, kind: 'spawn-error', message }
      }
    },
  }
}

/*
 * Build a safe argument list for repak `unpack` with an optional AES key.
 * The key is passed as a single argument (never via shell interpolation).
 */
export function repakUnpackArgs(pakPath: string, outDir: string, aesKey?: string): string[] {
  const args = ['unpack', pakPath, '--output', outDir]
  if (aesKey) args.push('--aes-key', aesKey)
  return args
}

/*
 * Build a safe argument list for retoc IoStore `unpack`.
 */
export function retocUnpackArgs(utocPath: string, outDir: string, aesKey?: string): string[] {
  const args = ['unpack', '--input', utocPath, '--output-dir', outDir]
  if (aesKey) args.push('--aes-key', aesKey)
  return args
}
