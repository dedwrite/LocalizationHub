import {
  useEffect,
  useState,
} from 'react'

import {
  translateWithGemini,
  translateWithGoogle,
  type TranslationProviderId,
} from './translationProviders'

import './MachineTranslationPanel.css'

type MachineTranslationPanelProps = {
  sourceLocale?: string
  targetLocale?: string
}

type LanguageOption = {
  value: string
  label: string
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
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

function normalizeInitialLanguage(
  locale: string | undefined,
  fallback: string,
) {
  const trimmed = locale?.trim()

  if (!trimmed) {
    return fallback
  }

  return trimmed
}

function MachineTranslationPanel({
  sourceLocale,
  targetLocale,
}: MachineTranslationPanelProps) {
  const [
    isOpen,
    setIsOpen,
  ] = useState(false)

  const [
    provider,
    setProvider,
  ] = useState<TranslationProviderId>(
    'gemini',
  )

  /*
   * API keys live in React memory only.
   *
   * They are intentionally never written to:
   * - localStorage
   * - project files
   * - config files
   * - disk
   */
  const [
    apiKey,
    setApiKey,
  ] = useState('')

  const [
    inputText,
    setInputText,
  ] = useState('')

  const [
    result,
    setResult,
  ] = useState('')

  const [
    detectedLanguage,
    setDetectedLanguage,
  ] = useState<string | null>(
    null,
  )

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  )

  const [
    isTranslating,
    setIsTranslating,
  ] = useState(false)

  /*
   * Project languages are only defaults.
   *
   * The user may override them inside
   * this reference tool without changing
   * the project itself.
   */
  const [
    sourceLanguage,
    setSourceLanguage,
  ] = useState(
    normalizeInitialLanguage(
      sourceLocale,
      'auto',
    ),
  )

  const [
    targetLanguage,
    setTargetLanguage,
  ] = useState(
    normalizeInitialLanguage(
      targetLocale,
      'ar',
    ),
  )

  /*
   * If a different project is opened,
   * update the MT defaults to match it.
   */
  useEffect(() => {
    setSourceLanguage(
      normalizeInitialLanguage(
        sourceLocale,
        'auto',
      ),
    )

    setTargetLanguage(
      normalizeInitialLanguage(
        targetLocale,
        'ar',
      ),
    )

    setResult('')
    setDetectedLanguage(null)
    setErrorMessage(null)
  }, [
    sourceLocale,
    targetLocale,
  ])

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
    setResult('')
    setDetectedLanguage(null)
    setErrorMessage(null)
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
    setApiKey('')

    clearResult()
  }

  function handleSourceLanguageChange(
    nextLanguage: string,
  ) {
    setSourceLanguage(
      nextLanguage,
    )

    clearResult()
  }

  function handleTargetLanguageChange(
    nextLanguage: string,
  ) {
    setTargetLanguage(
      nextLanguage,
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

    if (
      targetLanguage.trim() === ''
    ) {
      setErrorMessage(
        'Choose a target language.',
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

  function renderLanguageOptions(
    currentValue: string,
  ) {
    const known =
      LANGUAGE_OPTIONS.some(
        (option) =>
          option.value ===
          currentValue,
      )

    return (
      <>
        {
          !known &&
          currentValue !== 'auto' && (
            <option
              value={
                currentValue
              }
            >
              {currentValue}
            </option>
          )
        }

        {
          LANGUAGE_OPTIONS.map(
            (option) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {option.label}
                {' · '}
                {option.value}
              </option>
            ),
          )
        }
      </>
    )
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
              <label>
                <span>
                  From
                </span>

                <select
                  value={
                    sourceLanguage
                  }
                  disabled={
                    isTranslating
                  }
                  onChange={
                    (event) =>
                      handleSourceLanguageChange(
                        event.target.value,
                      )
                  }
                >
                  <option value="auto">
                    Auto detect
                  </option>

                  {
                    renderLanguageOptions(
                      sourceLanguage,
                    )
                  }
                </select>
              </label>

              <span
                className="machine-translation-arrow"
                aria-hidden="true"
              >
                →
              </span>

              <label>
                <span>
                  To
                </span>

                <select
                  value={
                    targetLanguage
                  }
                  disabled={
                    isTranslating
                  }
                  onChange={
                    (event) =>
                      handleTargetLanguageChange(
                        event.target.value,
                      )
                  }
                >
                  {
                    renderLanguageOptions(
                      targetLanguage,
                    )
                  }
                </select>
              </label>

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