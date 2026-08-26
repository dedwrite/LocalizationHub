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
  it('exposes only supported Gemini Flash models and defaults to 3.6 Flash', () => {
    expect(GEMINI_MODELS.map((m) => m.id)).toEqual(['gemini-3.6-flash', 'gemini-3.7-flash'])
    expect(GEMINI_MODELS.some((m) => m.id.includes('1.5'))).toBe(false)
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.6-flash')
  })

  it('does not reference the obsolete gemini-1.5-flash model anywhere', () => {
    // The obsolete model ID is not present in the supported model list or the
    // default, and the provider never hardcodes it.
    expect(GEMINI_MODELS.map((m) => m.id).join(' ')).not.toContain('1.5')
    expect(DEFAULT_GEMINI_MODEL).not.toContain('1.5')
  })

  it('defaults to gemini-3.6-flash in the request URL and omits deprecated sampling params', async () => {
    let capturedUrl = ''
    let capturedBody: any = null
    globalThis.fetch = vi.fn(async (input: any, init: any) => {
      capturedUrl = String(input)
      capturedBody = JSON.parse(init.body)
      return { ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'مرحبا' }] } }] }) }
    }) as unknown as typeof fetch

    await translateWithGemini(request())
    expect(capturedUrl).toContain('/models/gemini-3.6-flash:generateContent')
    expect(capturedUrl).not.toContain('gemini-1.5-flash')
    // No deprecated temperature/top_p sampling parameters.
    expect(capturedBody.generation_config.temperature).toBeUndefined()
    expect(capturedBody.generation_config.top_p).toBeUndefined()
    expect(capturedBody.generation_config.max_output_tokens).toBe(2048)
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

  it('uses the selected model when provided', async () => {
    let capturedUrl = ''
    globalThis.fetch = vi.fn(async (input: any) => {
      capturedUrl = String(input)
      return { ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'x' }] } }] }) }
    }) as unknown as typeof fetch
    await translateWithGemini(request({ model: 'gemini-3.7-flash' }))
    expect(capturedUrl).toContain('/models/gemini-3.7-flash:generateContent')
  })
})
