import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkWebBuild } from './webBuild'

const loaded = ['assets/index-current123.js']
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => vi.useRealTimers())

describe('Cloud import build freshness', () => {
  it('accepts the current entry and bypasses HTTP caching', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ entries: loaded }))
    await expect(checkWebBuild(loaded, fetcher)).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith('/web-build.json', { cache: 'no-store', signal: expect.any(AbortSignal) })
  })
  it('rejects an old open client even when a new project/file is used', async () => {
    await expect(checkWebBuild(loaded, vi.fn().mockResolvedValue(response({ entries: ['assets/index-next123.js'] })))).rejects.toThrow('reload this page')
  })
  it('checks again on each import instead of remembering a previous successful check', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ entries: loaded })).mockResolvedValueOnce(response({ entries: ['assets/index-next123.js'] }))
    await checkWebBuild(loaded, fetcher)
    await expect(checkWebBuild(loaded, fetcher)).rejects.toThrow('No project was created')
  })
  it.each([null, {}, { entries: [] }, { entries: [null] }, { entries: ['https://other.invalid/code.js'] }])('fails safely for an invalid build manifest: %j', async (body) => {
    await expect(checkWebBuild(loaded, vi.fn().mockResolvedValue(response(body)))).rejects.toThrow('Could not verify')
  })
  it('fails safely for HTML/404 fallback, network and server errors', async () => {
    for (const fetcher of [
      vi.fn().mockResolvedValue(new Response('<html>not a manifest</html>')),
      vi.fn().mockResolvedValue(response({}, 404)),
      vi.fn().mockResolvedValue(response({}, 500)),
      vi.fn().mockRejectedValue(new Error('private network details')),
    ]) await expect(checkWebBuild(loaded, fetcher)).rejects.toThrow('Could not verify the current Web App version.')
  })
  it('cannot accept a missing loaded entry identity', async () => {
    await expect(checkWebBuild([], vi.fn().mockResolvedValue(response({ entries: loaded })))).rejects.toThrow('reload this page')
  })
  it('bounds the wait for an unresponsive deployment', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))))
    const result = expect(checkWebBuild(loaded, fetcher)).rejects.toThrow('Could not verify')
    await vi.advanceTimersByTimeAsync(8000)
    await result
  })
})
