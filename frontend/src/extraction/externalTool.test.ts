import { describe, expect, it } from 'vitest'
import { createProcessRunner, repakUnpackArgs, retocUnpackArgs, type ExternalToolRunResult } from './externalTool'

function fakeSpawn(script: (args: string[]) => { code: number; stdout: string; stderr: string }) {
  return async (_command: string, args: string[]) => script(args)
}

describe('external tool adapter', () => {
  it('returns ok when the process exits zero', async () => {
    const runner = createProcessRunner(fakeSpawn(() => ({ code: 0, stdout: 'ok', stderr: '' })))
    const result = await runner.run({ id: 'repak', displayName: 'repak', executablePath: '/usr/bin/repak' }, ['info', 'x.pak'], {})
    expect(result.ok).toBe(true)
  })

  it('returns non-zero when the process fails', async () => {
    const runner = createProcessRunner(fakeSpawn(() => ({ code: 1, stdout: '', stderr: 'boom' })))
    const result = await runner.run({ id: 'repak', displayName: 'repak', executablePath: '/usr/bin/repak' }, ['unpack', 'x.pak'], {}) as Extract<ExternalToolRunResult, { ok: false }>
    expect(result.ok).toBe(false)
    expect(result.kind).toBe('non-zero')
    expect(result.stderr).toBe('boom')
  })

  it('maps ENOENT to not-found', async () => {
    const runner = createProcessRunner(async () => { throw new Error('spawn repak ENOENT') })
    const result = await runner.run({ id: 'repak', displayName: 'repak', executablePath: '/missing/repak' }, ['info'], {}) as Extract<ExternalToolRunResult, { ok: false }>
    expect(result.ok).toBe(false)
    expect(result.kind).toBe('not-found')
  })

  it('builds repak unpack args with an optional AES key (verified CLI contract)', () => {
    const args = repakUnpackArgs('C:/game/Data.pak', 'C:/tmp/out', 'secretkey')
    expect(args).toEqual(['--aes-key', 'secretkey', 'unpack', 'C:/game/Data.pak', '--output', 'C:/tmp/out'])
  })

  it('builds retoc unpack args positionally with an optional AES key (verified CLI contract)', () => {
    const withKey = retocUnpackArgs('C:/game/Data.utoc', 'C:/tmp/out', 'secretkey')
    expect(withKey).toEqual(['--aes-key', 'secretkey', 'unpack', 'C:/game/Data.utoc', 'C:/tmp/out'])

    const noKey = retocUnpackArgs('C:/game/Data.utoc', 'C:/tmp/out')
    expect(noKey).toEqual(['unpack', 'C:/game/Data.utoc', 'C:/tmp/out'])
  })
})
