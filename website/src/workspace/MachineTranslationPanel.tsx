import { useEffect, useState } from 'react'
import { buildTranslationContext, DEFAULT_GEMINI_MODEL, GEMINI_MODELS, LANGUAGE_OPTIONS, PROVIDER_API_KEY_LABELS, PROVIDER_API_KEY_PLACEHOLDERS, PROVIDER_LABELS, translateWithGemini, type GeminiModelId, type TranslationProviderId } from './translationProviders'

/*
 * Machine Translation Reference panel (Web).
 *
 * Reference only — the API key is held in memory for this component's lifetime
 * and never persisted or sent to the LocalizationHub backend. Reloading the
 * page drops the key, which is acceptable.
 */
export default function MachineTranslationPanel({
  sourceText,
  sourceLocale,
  targetLocale,
  context,
}: {
  sourceText?: string
  sourceLocale?: string
  targetLocale?: string
  context?: { speaker?: string; listener?: string; listeners?: string[]; speakerGender?: string; listenerGender?: string; listenerGenders?: string[]; scene?: string; conversationId?: string; previous?: string; next?: string }
}) {
  const [open, setOpen] = useState(false)
  const [provider] = useState<TranslationProviderId>('gemini')
  const [model, setModel] = useState<GeminiModelId>(DEFAULT_GEMINI_MODEL)
  const [apiKey, setApiKey] = useState('')
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState(sourceLocale || 'auto')
  const [targetLanguage, setTargetLanguage] = useState(targetLocale || 'ar')
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (sourceText) setInputText(sourceText)
  }, [sourceText])

  useEffect(() => {
    setSourceLanguage(sourceLocale || 'auto')
    setTargetLanguage(targetLocale || 'ar')
  }, [sourceLocale, targetLocale])

  async function translate() {
    if (!apiKey.trim()) { setError('Enter an API key first.'); return }
    if (!inputText.trim()) { setError('Paste some text to translate.'); return }
    setTranslating(true)
    setError('')
    setResult('')
    setElapsedMs(null)
    const started = performance.now()
    try {
      const res = await translateWithGemini({ apiKey: apiKey.trim(), text: inputText, sourceLanguage, targetLanguage, model, context: buildTranslationContext(context) })
      setResult(res.translatedText)
      setElapsedMs(Math.round(performance.now() - started))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Translation failed.')
      setElapsedMs(null)
    } finally {
      setTranslating(false)
    }
  }

  async function copyResult() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  const swapDisabled = sourceLanguage === 'auto'

  return (
    <div className="mt-panel">
      <button className="mt-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        Machine Translation Reference
        <span className="mt-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-body">
          <p className="mt-warning">Reference only. Your key stays in this browser tab and is never saved or shared.</p>
          <div className="mt-grid">
            <label className="dialog-field">
              Provider
              <select value={provider} disabled>
                <option value="gemini">{PROVIDER_LABELS.gemini}</option>
              </select>
            </label>
            <label className="dialog-field">
              Model
              <select value={model} onChange={(event) => { setModel(event.target.value as GeminiModelId); setResult(''); setError('') }}>
                {GEMINI_MODELS.map((item) => {
                  const speed = item.speedClass === 'fastest' ? 'Fastest' : item.speedClass === 'balanced' ? 'Balanced' : 'Highest quality'
                  return <option key={item.id} value={item.id}>{item.label} — {speed}</option>
                })}
              </select>
            </label>
            <label className="dialog-field">
              {PROVIDER_API_KEY_LABELS[provider]}
              <span className="secret-input-row">
                <input
                  type="text"
                  name="mt-provider-key"
                  className={showKey ? 'secret-reference-input' : 'secret-reference-input masked'}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={PROVIDER_API_KEY_PLACEHOLDERS[provider]}
                  aria-label={PROVIDER_API_KEY_LABELS[provider]}
                  aria-hidden={false}
                />
                <button type="button" className="dialog-button" onClick={() => setShowKey((value) => !value)} aria-pressed={showKey}>
                  {showKey ? 'Hide key' : 'Show key'}
                </button>
              </span>
            </label>
          </div>
          <div className="mt-lang-row">
            <label className="dialog-field">
              Source
              <select value={sourceLanguage} onChange={(event) => { setSourceLanguage(event.target.value); setResult('') }}>
                <option value="auto">Auto detect</option>
                {LANGUAGE_OPTIONS.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
              </select>
            </label>
            <button className="dialog-button mt-swap" onClick={() => { setSourceLanguage(targetLanguage); setTargetLanguage(sourceLanguage); setResult('') }} disabled={swapDisabled} title="Swap languages">⇄</button>
            <label className="dialog-field">
              Target
              <select value={targetLanguage} onChange={(event) => { setTargetLanguage(event.target.value); setResult('') }}>
                {LANGUAGE_OPTIONS.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
              </select>
            </label>
          </div>
          <label className="dialog-field">
            Text
            <textarea value={inputText} onChange={(event) => setInputText(event.target.value)} rows={3} placeholder="Paste or prefill source text" />
          </label>
          <div className="mt-actions">
            <button className="dialog-button dialog-button-primary" onClick={translate} disabled={translating}>
              {translating ? 'Translating…' : 'Translate'}
            </button>
            {result && <button className="dialog-button" onClick={() => { setResult(''); setError('') }}>Clear</button>}
          </div>
          {error && <p className="dialog-error" role="alert">{error}</p>}
          {result && (
            <div className="mt-result">
              <div className="mt-result-head">
                <strong>Result</strong>
                <button className="dialog-button" onClick={copyResult}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <p>{result}</p>
              {elapsedMs != null && <span className="mt-elapsed">Translated in {elapsedMs} ms</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
