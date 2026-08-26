import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS,
  TranslationProviderError,
  translateWithGemini,
  type TranslateRequest,
} from './workspace/translationProviders'

const originalFetch = globalThis.fetch

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body,
  })) as unknown as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

function request(overrides: Partial<TranslateRequest> = {}): TranslateRequest {
  return { apiKey: 'test-key', text: 'Hello', targetLanguage: 'ar', ...overrides }
}

describe('Gemini translation provider', () => {
  it('exposes supported models and defaults to the fast model', () => {
    expect(GEMINI_MODELS.map((m) => m.id)).toEqual(['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash'])
    expect(GEMINI_MODELS.some((m) => m.id.includes('1.5'))).toBe(false)
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.5-flash-lite')
  })

  it('does not reference the obsolete gemini-1.5-flash model anywhere', () => {
    // The obsolete model ID is not present in the supported model list or the
    // default, and the provider never hardcodes it.
    expect(GEMINI_MODELS.map((m) => m.id).join(' ')).not.toContain('1.5')
    expect(DEFAULT_GEMINI_MODEL).not.toContain('1.5')
  })

  it('assigns minimal/low thinking per model and never medium/high', () => {
    const thinking = Object.fromEntries(GEMINI_MODELS.map((m) => [m.id, m.thinkingLevel]))
    expect(thinking['gemini-3.5-flash-lite']).toBe('minimal')
    expect(thinking['gemini-3.6-flash']).toBe('minimal')
    expect(thinking['gemini-3.7-flash']).toBe('low')
    for (const level of Object.values(thinking)) {
      expect(['medium', 'high']).not.toContain(level)
    }
  })

  it('assigns the fast model as fastest speed class', () => {
    const fastest = GEMINI_MODELS.find((m) => m.speedClass === 'fastest')
    expect(fastest?.id).toBe('gemini-3.5-flash-lite')
  })

  it('defaults to gemini-3.5-flash-lite and sets explicit minimal thinking', async () => {
    let capturedUrl = ''
    let capturedBody: any = null
    globalThis.fetch = vi.fn(async (input: any, init: any) => {
      capturedUrl = String(input)
      capturedBody = JSON.parse(init.body)
      return { ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'مرحبا' }] } }] }) }
    }) as unknown as typeof fetch

    await translateWithGemini(request())
    expect(capturedUrl).toContain('/models/gemini-3.5-flash-lite:generateContent')
    expect(capturedUrl).not.toContain('gemini-1.5-flash')
    // Explicit thinking level, no deprecated sampling params.
    expect(capturedBody.generation_config.thinking_config.thinking_level).toBe('minimal')
    expect(capturedBody.generation_config.temperature).toBeUndefined()
    expect(capturedBody.generation_config.top_p).toBeUndefined()
    expect(capturedBody.generation_config.max_output_tokens).toBe(1024)
    expect(capturedBody.contents[0].parts[0].text).toBe('Hello')
    expect(capturedBody.system_instruction.parts[0].text).toContain('translation reference')
  })

  it('returns the translated text on success', async () => {
    mockFetch(200, { candidates: [{ content: { parts: [{ text: 'مرحبا' }] } }] })
    const result = await translateWithGemini(request())
    expect(result.translatedText).toBe('مرحبا')
  })

  it('reports an invalid API key error', async () => {
    mockFetch(403, { error: { message: 'PERMISSION_DENIED' } })
    await expect(translateWithGemini(request())).rejects.toMatchObject({ kind: 'invalid-key', message: expect.stringContaining('API key') })
  })

  it('reports a quota/rate-limit error', async () => {
    mockFetch(429, { error: { message: 'quota' } })
    await expect(translateWithGemini(request())).rejects.toMatchObject({ kind: 'quota' })
  })

  it('reports an unavailable model error', async () => {
    mockFetch(404, { error: { message: 'models/gemini-x not found' } })
    await expect(translateWithGemini(request())).rejects.toMatchObject({ kind: 'unavailable-model' })
  })

  it('reports a network error without leaking the key', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('network down') }) as unknown as typeof fetch
    const failure = await translateWithGemini(request()).catch((e) => e)
    expect(failure).toBeInstanceOf(TranslationProviderError)
    expect(failure.kind).toBe('network')
    expect(failure.message).not.toContain('test-key')
  })

  it('uses the selected model and its thinking level when provided', async () => {
    let capturedUrl = ''
    let capturedBody: any = null
    globalThis.fetch = vi.fn(async (input: any, init: any) => {
      capturedUrl = String(input)
      capturedBody = JSON.parse(init.body)
      return { ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'x' }] } }] }) }
    }) as unknown as typeof fetch
    await translateWithGemini(request({ model: 'gemini-3.7-flash' }))
    expect(capturedUrl).toContain('/models/gemini-3.7-flash:generateContent')
    expect(capturedBody.generation_config.thinking_config.thinking_level).toBe('low')
  })
})
