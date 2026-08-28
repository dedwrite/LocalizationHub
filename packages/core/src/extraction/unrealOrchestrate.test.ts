/*
 * Unreal archive orchestration tests (failure isolation + AES + version-aware).
 *
 * Pins the v0.7 Unreal behaviour:
 *   - encrypted-archive failures are reported as `encrypted-container`, never
 *     brute-forced or aborted.
 *   - unsupported serialization versions are reported as
 *     `unsupported-engine-version`, never "corrupt asset".
 *   - one failed archive does NOT abort the whole scan (failure isolation).
 *   - the user-provided AES key is threaded into repak/retoc arguments.
 */

import { describe, expect, it } from 'vitest'
import {
  orchestrateExtraction,
  buildArchivePlan,
  classifyToolFailure,
  type ExtractionPrimitives,
  type ScanFile,
} from './orchestrate'

function file(name: string): ScanFile {
  return { name, relativePath: name, absolutePath: `/tmp/${name}`, size: 0 }
}

const fullTools = { repak: 'repak', retoc: 'retoc', gdre: 'gdre', unitypy: 'python', unitypyScript: 'x.py', uassetdumper: 'uassetdumper' }

describe('classifyToolFailure', () => {
  it('classifies encryption failures as encrypted-container', () => {
    expect(classifyToolFailure('pak', 'Error: invalid AES key', '')).toBe('encrypted-container')
    expect(classifyToolFailure('iostore', 'failed to decrypt footer', '')).toBe('encrypted-container')
  })

  it('classifies version-header failures as unsupported-engine-version', () => {
    expect(classifyToolFailure('uasset', 'Unsupported asset version 123', '')).toBe('unsupported-engine-version')
    expect(classifyToolFailure('uasset', 'UAssetAPI 1.0.0 cannot parse UE5 version header', '')).toBe('unsupported-engine-version')
  })

  it('classifies other failures as external-tool-failed', () => {
    expect(classifyToolFailure('pak', 'disk full', '')).toBe('external-tool-failed')
  })
})

describe('buildArchivePlan', () => {
  it('builds pak/utoc/uasset jobs with AES-capable builders', () => {
    const plan = buildArchivePlan([file('game.pak'), file('a.uasset')], fullTools)
    expect(plan.jobs.map((j) => j.kind)).toEqual(['pak', 'uasset'])
    // AES key is threaded into the builder args.
    const pakJob = plan.jobs.find((j) => j.kind === 'pak')!
    expect(pakJob.buildArgs('/out', 'MYKEY')).toContain('MYKEY')
  })
})

describe('orchestrateExtraction failure isolation', () => {
  function primitivesWithFailure(): ExtractionPrimitives {
    return {
      runTool: async () => ({ code: 1, stdout: '', stderr: 'Unsupported asset version 999', timed_out: false, output_truncated: false }),
      createTempDir: async () => '/tmp/job',
      removeTempDir: async () => {},
      scanDirectory: async () => ({ files: [], directories: [] }),
      readText: async () => '',
      readBinary: async () => new Uint8Array(0),
    }
  }

  it('reports an unsupported-version diagnostic instead of throwing', async () => {
    const result = await orchestrateExtraction(
      { files: [file('bad.uasset')], directories: [] },
      fullTools,
      primitivesWithFailure(),
      {},
    )
    expect(result.diagnostics.some((d) => d.kind === 'unsupported-engine-version')).toBe(true)
  })

  it('reports an encrypted-container diagnostic without aborting', async () => {
    const primitives: ExtractionPrimitives = {
      ...primitivesWithFailure(),
      runTool: async () => ({ code: 1, stdout: '', stderr: 'Error: invalid AES key', timed_out: false, output_truncated: false }),
    }
    const result = await orchestrateExtraction(
      { files: [file('game.pak')], directories: [] },
      fullTools,
      primitives,
      {},
    )
    expect(result.diagnostics.some((d) => d.kind === 'encrypted-container')).toBe(true)
  })
})
