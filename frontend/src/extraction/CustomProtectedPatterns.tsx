import { useEffect, useMemo, useState } from 'react'
import {
  createCustomTokenProfile,
  previewCustomPattern,
  setCustomTokenProfile,
  validateCustomPattern,
  type CustomPattern,
} from '@localizationhub/core'
import './CustomProtectedPatterns.css'

/*
 * Extraction Profile — user-defined protected patterns.
 *
 * Lets users protect engine/game-specific tokens (e.g. `[[STAT]]`, `<color>`,
 * `{#id}`) that the built-in profiles don't cover. Each pattern is a regex
 * source string with a label; it is validated before it can be added, and the
 * combined list is registered as the `custom` token profile.
 */

const STORAGE_KEY = 'localizationhub.customPatterns'
const DEFAULT_SAMPLE = 'Buy 3 [[POTION]]s for {GOLD} gold <color=#fff>now</color>.'

function loadPatterns(): CustomPattern[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>
    return raw
      .filter((item): item is CustomPattern => typeof item.id === 'string' && typeof item.label === 'string' && typeof item.pattern === 'string')
      .map((item) => ({ id: item.id, label: item.label, pattern: item.pattern as string }))
  } catch {
    return []
  }
}

function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export default function CustomProtectedPatterns({ onClose }: { onClose: () => void }) {
  const [patterns, setPatterns] = useState<CustomPattern[]>(loadPatterns)
  const [label, setLabel] = useState('')
  const [pattern, setPattern] = useState('')
  const [sample, setSample] = useState(DEFAULT_SAMPLE)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
    // Register the combined profile (or clear it when empty) so the `custom`
    // token profile resolves for validation across the app.
    setCustomTokenProfile(patterns.length > 0 ? createCustomTokenProfile(patterns) : undefined)
  }, [patterns])

  // Register on first mount too (e.g. app reload with saved patterns).
  useEffect(() => {
    return () => setCustomTokenProfile(undefined)
  }, [])

  const patternValidation = useMemo(() => validateCustomPattern(pattern), [pattern])

  function handleAdd() {
    const trimmedLabel = label.trim()
    const trimmedPattern = pattern.trim()
    if (!trimmedLabel) {
      setAddError('Label is required.')
      return
    }
    const validation = validateCustomPattern(trimmedPattern)
    if (!validation.valid) {
      setAddError(validation.error)
      return
    }
    setPatterns((current) => [...current, { id: newId(), label: trimmedLabel, pattern: trimmedPattern }])
    setLabel('')
    setPattern('')
    setAddError('')
  }

  function handleRemove(id: string) {
    setPatterns((current) => current.filter((p) => p.id !== id))
  }

  const samplePreview = useMemo(() => {
    // Show sample tokens using the *built-in* profiles plus custom patterns.
    const custom = patterns.length > 0 ? createCustomTokenProfile(patterns) : null
    const customMatches = custom
      ? patterns.flatMap((p) => previewCustomPattern(p.pattern, sample).matches.map((m) => m.raw))
      : []
    return customMatches
  }, [patterns, sample])

  return (
    <main className="cpp">
      <header className="cpp-header">
        <h1>Extraction Profile</h1>
        <button className="cpp-close" onClick={onClose}>Done</button>
      </header>

      <p className="cpp-lede">
        Protect game-specific tokens the built-in profiles miss. Add a regex and a label; patterns are
        validated before they can be saved and apply immediately to the <strong>Custom</strong> token
        profile.
      </p>

      <section className="cpp-add">
        <div className="cpp-add-fields">
          <input
            className="cpp-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (e.g. Stat token)"
            aria-label="Pattern label"
          />
          <input
            className="cpp-pattern"
            value={pattern}
            onChange={(event) => {
              setPattern(event.target.value)
              setAddError('')
            }}
            placeholder="Regex (e.g. \[\[\\w+\]\])"
            aria-label="Pattern regex"
            aria-invalid={pattern.length > 0 && !patternValidation.valid}
          />
          <button className="cpp-button" onClick={handleAdd} disabled={!label.trim() || !patternValidation.valid}>
            Add
          </button>
        </div>
        {pattern.length > 0 && !patternValidation.valid && (
          <p className="cpp-error">{patternValidation.valid ? '' : patternValidation.error}</p>
        )}
        {addError && <p className="cpp-error">{addError}</p>}
      </section>

      <section className="cpp-list">
        {patterns.length === 0 ? (
          <p className="cpp-empty">No custom patterns yet. Add one above.</p>
        ) : (
          patterns.map((p) => {
            const validation = validateCustomPattern(p.pattern)
            const preview = validation.valid ? previewCustomPattern(p.pattern, sample) : null
            return (
              <div key={p.id} className="cpp-row">
                <div className="cpp-row-main">
                  <strong>{p.label}</strong>
                  <code className="cpp-row-pattern">{p.pattern}</code>
                  {preview && (
                    <span className="cpp-row-matches">
                      {preview.matches.length > 0
                        ? `${preview.matches.length} match${preview.matches.length === 1 ? '' : 'es'} in sample`
                        : 'no matches in sample'}
                    </span>
                  )}
                </div>
                <button className="cpp-button cpp-remove" onClick={() => handleRemove(p.id)}>
                  Remove
                </button>
              </div>
            )
          })
        )}
      </section>

      <section className="cpp-preview">
        <h2>Preview</h2>
        <input
          className="cpp-sample"
          value={sample}
          onChange={(event) => setSample(event.target.value)}
          placeholder="Sample text"
          aria-label="Sample text"
        />
        <p className="cpp-sample-tokens">
          {samplePreview.length > 0 ? `Protected: ${samplePreview.join(', ')}` : 'No protected tokens in sample.'}
        </p>
      </section>
    </main>
  )
}
