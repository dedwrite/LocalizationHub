/*
 * Godot binary-resource derived-copy pipeline tests.
 *
 * Pins the gap-closing behaviour:
 *   - `gdreBinToTxtArgs` writes to --output (read-only-safe, input untouched).
 *   - `gdreDecompileArgs` targets .gdc with an optional bytecode version.
 *   - buildArchivePlan routes binary .res/.scn/.gdc into godot-binary jobs
 *     (with the correct convertTo remap) when GDRE is configured, and leaves
 *     them loose (reported, not read) otherwise.
 *   - copyFile is required for the safe derived-copy path (no in-place writes).
 */

import { describe, expect, it } from 'vitest'
import { gdreBinToTxtArgs, gdreDecompileArgs } from './toolArgs'
import { buildArchivePlan } from './orchestrate'
import type { ScanFile } from './scanGame'

function file(name: string): ScanFile {
  return { name, relativePath: name, absolutePath: `/game/${name}`, size: 0 }
}

const gdre = { gdre: '/tools/gdre_tools.exe' }

describe('GDRE deep-format argument builders', () => {
  it('bin-to-txt writes to --output (derived copy, not in-place)', () => {
    const args = gdreBinToTxtArgs('/tmp/x.scn', '/tmp/out')
    expect(args).toContain('--headless')
    expect(args).toContain('--bin-to-txt=/tmp/x.scn')
    expect(args).toContain('--output=/tmp/out')
  })

  it('decompile targets .gdc with an optional bytecode version', () => {
    expect(gdreDecompileArgs('/tmp/x.gdc', '/tmp/out')).toContain('--decompile=/tmp/x.gdc')
    expect(gdreDecompileArgs('/tmp/x.gdc', '/tmp/out', '4.3.0')).toContain('--bytecode=4.3.0')
  })
})

describe('buildArchivePlan godot binary resources', () => {
  it('routes .scn/.res/.gdc into godot-binary jobs with convertTo remap', () => {
    const plan = buildArchivePlan([file('a.scn'), file('b.res'), file('c.gdc')], gdre)
    expect(plan.jobs).toHaveLength(3)
    expect(plan.jobs.map((j) => j.kind)).toEqual(['godot-binary', 'godot-binary', 'godot-binary'])
    expect(plan.jobs[0].convertTo).toBe('.tscn')
    expect(plan.jobs[1].convertTo).toBe('.tres')
    expect(plan.jobs[2].convertTo).toBe('.gd')
    expect(plan.looseFiles).toHaveLength(0)
  })

  it('leaves binary resources loose (reported, not converted) when GDRE is absent', () => {
    const plan = buildArchivePlan([file('a.scn')], {})
    expect(plan.jobs).toHaveLength(0)
    expect(plan.looseFiles).toHaveLength(1)
  })
})
