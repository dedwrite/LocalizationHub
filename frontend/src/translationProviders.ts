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
 * Gemini
 * Google AI Studio API key.
 *
 * The API key is passed only with
 * the current Tauri invoke call.
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
 * Google Cloud Translation.
 *
 * Kept as an additional provider
 * for users who prefer Google's
 * dedicated translation service.
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

/*
 * DeepL.
 *
 * DeepL Free / Pro endpoint selection
 * is handled entirely by the Rust
 * backend.
 *
 * The key remains session-only.
 */
export async function translateWithDeepL(
  request:
    TranslateRequest,
) {
  return invoke<TranslateResult>(
    'translate_with_deepl',
    {
      request,
    },
  )
}