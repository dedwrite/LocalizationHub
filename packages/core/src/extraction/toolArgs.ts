/*
 * External-tool argument builders (pure, side-effect free).
 *
 * Each builder encodes a VERIFIED CLI contract for a specific tool. These
 * builders are shared between the desktop orchestrator and the Node/Vitest
 * integration harness so both invoke the exact same command shape.
 *
 * Verified contracts (as of 2026-08-27):
 *   - repak_cli 0.2.3 : repak [--aes-key KEY] unpack <INPUT> --output <DIR>
 *   - retoc_cli 0.1.5 : retoc [--aes-key KEY] unpack <UTOC> <OUTPUT>  (positional)
 *   - GDRE Tools v2.4.0: gdre_tools.exe --headless --extract=<PCK> --output=<DIR>
 *                        gdre_tools.exe --headless --bin-to-txt=<FILE>
 *   - UnityPy 1.25.3 (helper script): python <script> <INPUT> <OUTPUT_DIR>
 *   - UAssetDumper (net6.0): UAssetDumper.exe tojson <INPUT.uasset> <OUTPUT.json>
 */

export type ToolId =
  | 'repak'
  | 'retoc'
  | 'gdre'
  | 'unitypy'
  | 'uassetdumper'

export type ToolPaths = {
  repak?: string
  retoc?: string
  gdre?: string
  /* Python executable that runs the UnityPy helper script. */
  unitypy?: string
  /* Path to the UnityPy helper script (unitypy-extract.py). */
  unitypyScript?: string
  uassetdumper?: string
}

export function repakUnpackArgs(pakPath: string, outDir: string, aesKey?: string): string[] {
  const args: string[] = []
  if (aesKey) args.push('--aes-key', aesKey)
  args.push('unpack', pakPath, '--output', outDir)
  return args
}

export function retocUnpackArgs(utocPath: string, outDir: string, aesKey?: string): string[] {
  const args: string[] = []
  if (aesKey) args.push('--aes-key', aesKey)
  args.push('unpack', utocPath, outDir)
  return args
}

export function gdreExtractArgs(pckPath: string, outDir: string, aesKey?: string): string[] {
  const args: string[] = ['--headless', `--extract=${pckPath}`, `--output=${outDir}`]
  if (aesKey) args.push(`--key=${aesKey}`)
  return args
}

export function gdreBinToTxtArgs(filePath: string): string[] {
  return ['--headless', `--bin-to-txt=${filePath}`]
}

export function unitypyExtractArgs(scriptPath: string, inputPath: string, outDir: string): string[] {
  return [scriptPath, inputPath, outDir]
}

export function uassetdumperToJsonArgs(inputPath: string, outJsonPath: string): string[] {
  return ['tojson', inputPath, outJsonPath]
}
