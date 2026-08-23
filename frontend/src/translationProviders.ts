import {
  invoke,
} from '@tauri-apps/api/core'

export type TranslationProviderId =
  | 'gemini'
  | 'google'
  | 'deepl'

export type TranslateRequest = {
  apiKey:
    string

  text:
    string

  sourceLanguage?:
    string

  targetLanguage:
    string
}

export type TranslateResult = {
  translatedText:
    string

  detectedSourceLanguage?:
    string
}

/*
 * Gemini API
 * Google AI Studio key.
 *
 * The key is passed only for this invoke call.
 * Nothing is persisted here.
 */
export async function translateWithGemini(
  request:
    TranslateRequest,
) {
  return invoke<TranslateResult>(
    'translate_with_gemini',
    {
      request,
    },
  )
}

/*
 * Google Cloud Translation API.
 *
 * Kept as an additional provider
 * for users who prefer the dedicated
 * translation service.
 */
export async function translateWithGoogle(
  request:
    TranslateRequest,
) {
  return invoke<TranslateResult>(
    'translate_with_google',
    {
      request,
    },
  )
}