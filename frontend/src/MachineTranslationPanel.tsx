import {
  useState,
} from 'react'

import {
  translateWithGemini,
  translateWithGoogle,
  type TranslationProviderId,
} from './translationProviders'

import './MachineTranslationPanel.css'

type MachineTranslationPanelProps = {
  sourceLocale?:
    string

  targetLocale?:
    string
}

function MachineTranslationPanel({
  sourceLocale,
  targetLocale,
}: MachineTranslationPanelProps) {
  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false)

  const [
    provider,
    setProvider,
  ] =
    useState<TranslationProviderId>(
      'gemini',
    )

  /*
   * Session-only API key.
   *
   * Intentionally never written to:
   * - localStorage
   * - project files
   * - config files
   * - disk
   */
  const [
    apiKey,
    setApiKey,
  ] =
    useState('')

  const [
    inputText,
    setInputText,
  ] =
    useState('')

  const [
    result,
    setResult,
  ] =
    useState('')

  const [
    detectedLanguage,
    setDetectedLanguage,
  ] =
    useState<string | null>(
      null,
    )

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    )

  const [
    isTranslating,
    setIsTranslating,
  ] =
    useState(false)

  const sourceLanguage =
    sourceLocale ??
    'auto'

  const targetLanguage =
    targetLocale ??
    'ar'

  const providerLabel =
    provider === 'gemini'
      ? 'Gemini · Google AI Studio'
      : provider === 'google'
        ? 'Google Cloud Translation'
        : 'DeepL'

  const apiKeyLabel =
    provider === 'gemini'
      ? 'Gemini API Key'
      : provider === 'google'
        ? 'Google Cloud API Key'
        : 'DeepL API Key'

  const apiKeyPlaceholder =
    provider === 'gemini'
      ? 'Google AI Studio key · session only'
      : provider === 'google'
        ? 'Google Cloud key · session only'
        : 'DeepL key · session only'

  const providerReady =
    provider === 'gemini' ||
    provider === 'google'

  const canTranslate =
    providerReady &&
    apiKey.trim() !== '' &&
    inputText.trim() !== '' &&
    targetLanguage.trim() !== '' &&
    !isTranslating

  function clearResult() {
    setResult(
      '',
    )

    setDetectedLanguage(
      null,
    )

    setErrorMessage(
      null,
    )
  }

  function handleProviderChange(
    nextProvider:
      TranslationProviderId,
  ) {
    setProvider(
      nextProvider,
    )

    /*
     * Never carry one provider's key
     * into another provider.
     */
    setApiKey(
      '',
    )

    clearResult()
  }

  async function handleTranslate() {
    if (
      provider === 'deepl'
    ) {
      setErrorMessage(
        'DeepL support is not connected yet.',
      )

      return
    }

    if (
      apiKey.trim() === ''
    ) {
      setErrorMessage(
        'Enter an API key first.',
      )

      return
    }

    if (
      inputText.trim() === ''
    ) {
      setErrorMessage(
        'Paste some text to translate.',
      )

      return
    }

    setIsTranslating(
      true,
    )

    clearResult()

    try {
      const request = {
        apiKey:
          apiKey.trim(),

        text:
          inputText,

        sourceLanguage:
          sourceLanguage
            .toLowerCase() ===
          'auto'
            ? undefined
            : sourceLanguage,

        targetLanguage,
      }

      const response =
        provider === 'gemini'
          ? await translateWithGemini(
              request,
            )
          : await translateWithGoogle(
              request,
            )

      setResult(
        response.translatedText,
      )

      setDetectedLanguage(
        response.detectedSourceLanguage ??
          null,
      )
    } catch (
      error
    ) {
      const message =
        typeof error ===
        'string'
          ? error
          : error instanceof Error
            ? error.message
            : 'Translation failed.'

      setErrorMessage(
        message,
      )
    } finally {
      setIsTranslating(
        false,
      )
    }
  }

  return (
    <section
      className={
        isOpen
          ? 'machine-translation-panel open'
          : 'machine-translation-panel'
      }
    >
      <button
        className="machine-translation-toggle"
        type="button"
        onClick={() => {
          setIsOpen(
            (current) =>
              !current,
          )
        }}
        aria-expanded={
          isOpen
        }
      >
        <div className="machine-translation-toggle-title">
          <span className="machine-translation-toggle-icon">
            MT
          </span>

          <div>
            <strong>
              Machine Translation Reference
            </strong>

            <span>
              {providerLabel}
              {' · '}
              {sourceLanguage}
              {' → '}
              {targetLanguage}
            </span>
          </div>
        </div>

        <span
          className={
            isOpen
              ? 'machine-translation-chevron open'
              : 'machine-translation-chevron'
          }
          aria-hidden="true"
        >
          ↓
        </span>
      </button>

      {
        isOpen && (
          <div className="machine-translation-body">
            <div className="machine-translation-heading">
              <div>
                <span className="machine-translation-eyebrow">
                  Reference Tool
                </span>

                <h3>
                  Machine Translation
                </h3>
              </div>

              <span className="machine-translation-badge">
                Manual
              </span>
            </div>

            <div className="machine-translation-controls">
              <label>
                <span>
                  Provider
                </span>

                <select
                  value={
                    provider
                  }
                  disabled={
                    isTranslating
                  }
                  onChange={
                    (event) =>
                      handleProviderChange(
                        event.target
                          .value as
                          TranslationProviderId,
                      )
                  }
                >
                  <option value="gemini">
                    Gemini · Google AI Studio
                  </option>

                  <option value="google">
                    Google Cloud Translation
                  </option>

                  <option value="deepl">
                    DeepL · Coming Next
                  </option>
                </select>
              </label>

              <label className="machine-translation-api-key">
                <span>
                  {apiKeyLabel}
                </span>

                <input
                  type="password"
                  value={
                    apiKey
                  }
                  disabled={
                    isTranslating ||
                    provider === 'deepl'
                  }
                  onChange={
                    (event) => {
                      setApiKey(
                        event.target.value,
                      )

                      setErrorMessage(
                        null,
                      )
                    }
                  }
                  placeholder={
                    apiKeyPlaceholder
                  }
                  autoComplete="off"
                  spellCheck={
                    false
                  }
                />
              </label>
            </div>

            <div className="machine-translation-languages">
              <div>
                <span>
                  From
                </span>

                <strong>
                  {sourceLanguage}
                </strong>
              </div>

              <span
                className="machine-translation-arrow"
                aria-hidden="true"
              >
                →
              </span>

              <div>
                <span>
                  To
                </span>

                <strong>
                  {targetLanguage}
                </strong>
              </div>

              {
                detectedLanguage && (
                  <div>
                    <span>
                      Detected
                    </span>

                    <strong>
                      {detectedLanguage}
                    </strong>
                  </div>
                )
              }
            </div>

            <label className="machine-translation-input">
              <span>
                Text to understand
              </span>

              <textarea
                value={
                  inputText
                }
                disabled={
                  isTranslating
                }
                onChange={
                  (event) => {
                    setInputText(
                      event.target.value,
                    )

                    setErrorMessage(
                      null,
                    )
                  }
                }
                placeholder="Copy and paste a word, phrase, or sentence from the source..."
                dir="auto"
                rows={
                  4
                }
              />
            </label>

            <div className="machine-translation-actions">
              <span>
                {
                  provider === 'gemini'
                    ? 'Sent to Gemini only when you press Translate.'
                    : provider === 'google'
                      ? 'Sent to Google Cloud only when you press Translate.'
                      : 'DeepL support will be connected next.'
                }
              </span>

              <button
                type="button"
                disabled={
                  !canTranslate
                }
                onClick={() => {
                  void handleTranslate()
                }}
                style={{
                  cursor:
                    canTranslate
                      ? 'pointer'
                      : 'not-allowed',

                  opacity:
                    canTranslate
                      ? 1
                      : 0.65,
                }}
                title={
                  provider === 'deepl'
                    ? 'DeepL support is not connected yet'
                    : apiKey.trim() === ''
                      ? 'Enter an API key'
                      : inputText.trim() === ''
                        ? 'Paste some text first'
                        : `Translate with ${providerLabel}`
                }
              >
                {
                  isTranslating
                    ? 'Translating...'
                    : 'Translate'
                }
              </button>
            </div>

            {
              errorMessage && (
                <div
                  className="machine-translation-result-box"
                  role="alert"
                >
                  {errorMessage}
                </div>
              )
            }

            <div className="machine-translation-result">
              <span>
                Result
              </span>

              <div
                className="machine-translation-result-box"
                dir="auto"
              >
                {
                  result !== ''
                    ? result
                    : 'Translation result will appear here.'
                }
              </div>
            </div>

            <div className="machine-translation-notice">
              <strong>
                Reference only
              </strong>

              <p>
                Machine translation may miss
                context, tone, terminology,
                character intent, or cultural
                meaning. Use it to understand
                difficult words or phrases,
                then write and review the
                translation yourself.
              </p>

              <small>
                Text is sent only when you press
                Translate. API keys are kept in
                memory for the current session
                only and are never saved by
                LocalizationHub. Your selected
                provider&apos;s privacy and
                data-use terms still apply.
              </small>
            </div>
          </div>
        )
      }
    </section>
  )
}

export default MachineTranslationPanel