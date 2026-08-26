/*
 * Machine Translation Reference providers for the Web Workspace.
 *
 * The API key is session-only and lives in React state (memory). It is never
 * written to localStorage/sessionStorage, never sent to the LocalizationHub
 * backend, and never included in project data.
 *
 * Requests go DIRECTLY to the provider from the browser where CORS permits.
 * Gemini (Google AI Studio) exposes a browser-callable REST endpoint, so it is
 * supported here. Providers that do not permit direct browser calls are
 * deliberately not silently proxied through the LocalizationHub backend.
 */

export type TranslationProviderId = 'gemini'

export type TranslateRequest = {
  apiKey: string
  text: string
  sourceLanguage?: string
  targetLanguage: string
}

export type TranslateResult = {
  translatedText: string
  detectedSourceLanguage?: string
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export const PROVIDER_LABELS: Record<TranslationProviderId, string> = {
  gemini: 'Gemini · Google AI Studio',
}

export const PROVIDER_API_KEY_LABELS: Record<TranslationProviderId, string> = {
  gemini: 'Gemini API Key',
}

export const PROVIDER_API_KEY_PLACEHOLDERS: Record<TranslationProviderId, string> = {
  gemini: 'Google AI Studio key · session only',
}

export const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ar', label: 'Arabic' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'zh-TW', label: 'Chinese (Traditional)' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'pl', label: 'Polish' },
  { value: 'tr', label: 'Turkish' },
  { value: 'nl', label: 'Dutch' },
  { value: 'sv', label: 'Swedish' },
  { value: 'no', label: 'Norwegian' },
  { value: 'da', label: 'Danish' },
  { value: 'fi', label: 'Finnish' },
  { value: 'cs', label: 'Czech' },
  { value: 'id', label: 'Indonesian' },
  { value: 'th', label: 'Thai' },
  { value: 'vi', label: 'Vietnamese' },
]

export async function translateWithGemini(request: TranslateRequest): Promise<TranslateResult> {
  const parts: Array<{ text: string }> = []
  if (request.sourceLanguage && request.sourceLanguage !== 'auto') {
    parts.push({ text: `Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}. Return only the translation.` })
  } else {
    parts.push({ text: `Translate the following text to ${request.targetLanguage}. Return only the translation.` })
  }
  parts.push({ text: request.text })

  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(request.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1 },
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let message = `Translation provider returned HTTP ${response.status}.`
    try {
      const parsed = JSON.parse(body)
      message = parsed?.error?.message || message
    } catch {
      // Ignore parse failures; keep the generic message.
    }
    throw new Error(message)
  }

  const data = await response.json()
  const translatedText = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? ''
  if (!translatedText.trim()) throw new Error('Translation provider returned no result.')
  return { translatedText: translatedText.trim() }
}
