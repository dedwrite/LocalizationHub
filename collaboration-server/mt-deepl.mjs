import { createRateLimiter } from './rate-limit.mjs'

/*
 * DeepL translation proxy for the Web App.
 *
 * SECURITY:
 * - Never log apiKey or text.
 * - Never persist keys or request bodies.
 * - Return sanitized provider errors only.
 *
 * Free keys ending in ":fx" use api-free.deepl.com; otherwise api.deepl.com.
 */

const DEEPL_FREE_URL = 'https://api-free.deepl.com/v2/translate'
const DEEPL_PRO_URL = 'https://api.deepl.com/v2/translate'
const REQUEST_TIMEOUT_MS = 20_000
const MAX_TEXT_CHARS = 50_000

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 })

function deeplEndpoint(apiKey) {
  return apiKey.endsWith(':fx') ? DEEPL_FREE_URL : DEEPL_PRO_URL
}

function normalizeSourceLanguage(language) {
  if (!language || typeof language !== 'string') return null
  const trimmed = language.trim()
  if (!trimmed || trimmed.toLowerCase() === 'auto') return null
  const normalized = trimmed.replace(/_/g, '-').toLowerCase()
  if (normalized === 'en-us' || normalized === 'en-gb') return 'EN'
  if (normalized === 'pt-br' || normalized === 'pt-pt') return 'PT'
  if (normalized === 'zh-cn' || normalized === 'zh-tw' || normalized === 'zh-hans' || normalized === 'zh-hant') return 'ZH'
  if (normalized === 'no' || normalized === 'nb') return 'NB'
  const code = (normalized.split('-')[0] || normalized).toUpperCase()
  return code || null
}

function normalizeTargetLanguage(language) {
  if (!language || typeof language !== 'string') return null
  const trimmed = language.trim()
  if (!trimmed || trimmed.toLowerCase() === 'auto') return null
  const normalized = trimmed.replace(/_/g, '-').toLowerCase()
  if (normalized === 'en' || normalized === 'en-us') return 'EN-US'
  if (normalized === 'en-gb') return 'EN-GB'
  if (normalized === 'pt') return 'PT-PT'
  if (normalized === 'pt-br') return 'PT-BR'
  if (normalized === 'pt-pt') return 'PT-PT'
  if (normalized === 'zh-cn' || normalized === 'zh-hans') return 'ZH-HANS'
  if (normalized === 'zh-tw' || normalized === 'zh-hant') return 'ZH-HANT'
  if (normalized === 'zh') return 'ZH'
  if (normalized === 'no' || normalized === 'nb') return 'NB'
  const code = (normalized.split('-')[0] || normalized).toUpperCase()
  return code || null
}

function deeplErrorMessage(status) {
  if (status === 400) return 'DeepL rejected the request. Check the selected languages and text.'
  if (status === 401 || status === 403) return 'DeepL rejected the API key. Check that the key is valid and belongs to a DeepL API account.'
  if (status === 413) return 'The text is too large for a single DeepL request.'
  if (status === 429) return 'DeepL rate limit was reached. Try again shortly.'
  if (status === 456) return 'DeepL translation quota has been reached.'
  if (status >= 500) return 'DeepL is temporarily unavailable. Try again later.'
  return `DeepL request failed with status ${status}.`
}

function clientKey(request) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return request.socket?.remoteAddress || 'unknown'
}

export async function proxyDeepLTranslate(request, body) {
  if (!rateLimiter.allow(clientKey(request))) {
    return { status: 429, body: { error: 'rate-limited', message: 'Too many translation requests. Try again shortly.' } }
  }

  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!apiKey) return { status: 400, body: { error: 'invalid-request', message: 'Enter a DeepL API key.' } }
  if (!text) return { status: 400, body: { error: 'invalid-request', message: 'Paste some text to translate.' } }
  if (text.length > MAX_TEXT_CHARS) {
    return { status: 413, body: { error: 'invalid-request', message: 'The text is too large for a single DeepL request.' } }
  }

  const targetLang = normalizeTargetLanguage(body?.targetLanguage)
  if (!targetLang) return { status: 400, body: { error: 'invalid-request', message: 'Choose a valid target language.' } }
  const sourceLang = normalizeSourceLanguage(body?.sourceLanguage)

  const payload = {
    text: [text],
    target_lang: targetLang,
    preserve_formatting: true,
  }
  if (sourceLang) payload.source_lang = sourceLang

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(deeplEndpoint(apiKey), {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      return { status: response.status === 429 || response.status === 456 ? response.status : 400, body: { error: 'provider', message: deeplErrorMessage(response.status) } }
    }

    const data = await response.json()
    const translation = data?.translations?.[0]
    if (!translation?.text) {
      return { status: 502, body: { error: 'provider', message: 'DeepL returned no translation.' } }
    }

    return {
      status: 200,
      body: {
        translatedText: translation.text,
        detectedSourceLanguage: translation.detected_source_language ?? null,
      },
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { status: 504, body: { error: 'network', message: 'DeepL request timed out. Try again.' } }
    }
    return { status: 502, body: { error: 'network', message: 'Could not connect to DeepL.' } }
  } finally {
    clearTimeout(timer)
  }
}

export const __test__ = {
  normalizeSourceLanguage,
  normalizeTargetLanguage,
  deeplEndpoint,
  deeplErrorMessage,
}
