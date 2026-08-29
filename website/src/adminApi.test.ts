import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeRadioAudioAdmin } from './adminApi'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('Admin Radio audio analysis request', () => {
  it('times out with an actionable error and aborts the upload', async () => {
    let aborted = false
    globalThis.fetch = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    })) as typeof fetch

    const file = new File([new TextEncoder().encode('ID3 synthetic fixture')], 'synthetic.mp3', { type: 'audio/mpeg' })
    await expect(analyzeRadioAudioAdmin(file, undefined, { timeoutMs: 10 })).rejects.toMatchObject({
      message: 'Audio analysis took too long. Retry analysis.',
      code: 'audio-analysis-timeout',
    })
    expect(aborted).toBe(true)
  })

  it('preserves caller cancellation as cancellation rather than a timeout', async () => {
    globalThis.fetch = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })) as typeof fetch
    const controller = new AbortController()
    const file = new File([new TextEncoder().encode('ID3 synthetic fixture')], 'synthetic.mp3', { type: 'audio/mpeg' })
    const pending = analyzeRadioAudioAdmin(file, undefined, { signal: controller.signal, timeoutMs: 1_000 })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
