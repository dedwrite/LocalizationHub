import { useEffect, useRef, useState } from 'react'
import { extractProtectedTokens, type TokenProfileId } from '@localizationhub/core'
import MachineTranslationPanel from './MachineTranslationPanel'

type EditorPanelProps = {
  entry: any
  status: string
  writable: boolean
  tokenProfileId: TokenProfileId
  issues: Array<{ severity: 'error' | 'warning'; message: string }>
  direction: 'ltr' | 'rtl' | 'auto'
  position: number
  total: number
  onTranslationChange: (value: string) => void
  onStatusChange: (status: string) => void
  onNextUntranslated: () => void
  onPrevUntranslated: () => void
  onJumpTo: (position: number) => void
  sourceLocale?: string
  targetLocale?: string
}

const STATUSES = ['draft', 'translated', 'needs-review', 'approved'] as const

function friendlyStatus(status: string) {
  return status.replace('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function ProtectedSource({ text, profileId }: { text: string; profileId: TokenProfileId }) {
  const tokens = extractProtectedTokens(text, profileId)
  if (tokens.length === 0) return <>{text}</>
  const spans: React.ReactNode[] = []
  let cursor = 0
  tokens.forEach((token, i) => {
    if (token.start > cursor) spans.push(<span key={`text-${i}`}>{text.slice(cursor, token.start)}</span>)
    spans.push(<span key={`token-${i}`} className="protected-token">{text.slice(token.start, token.end)}</span>)
    cursor = token.end
  })
  if (cursor < text.length) spans.push(<span key="tail">{text.slice(cursor)}</span>)
  return <>{spans}</>
}

export default function EditorPanel(props: EditorPanelProps) {
  const { entry, status, writable, tokenProfileId, issues, direction, position, total, onTranslationChange, onStatusChange, onNextUntranslated, onPrevUntranslated, onJumpTo, sourceLocale, targetLocale } = props
  const [jumpOpen, setJumpOpen] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const source = entry?.source ?? ''
  const translation = entry?.translation ?? ''

  useEffect(() => {
    if (entry) setJumpValue(String(position + 1))
  }, [entry, position])

  async function copySource() {
    if (!source) return
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore.
    }
  }

  function submitJump(event: React.FormEvent) {
    event.preventDefault()
    const value = Number.parseInt(jumpValue, 10)
    if (Number.isInteger(value) && value >= 1 && value <= total) {
      onJumpTo(value - 1)
      setJumpOpen(false)
    }
  }

  return (
    <div className="editor-panel">
      <div className="editor-topbar">
        <div className="editor-position">
          <button className="link-button" onClick={() => setJumpOpen((v) => !v)} aria-expanded={jumpOpen}>
            {position + 1} / {total}
          </button>
          {jumpOpen && (
            <form className="jump-form" onSubmit={submitJump}>
              <input
                inputMode="numeric"
                value={jumpValue}
                onChange={(event) => setJumpValue(event.target.value)}
                autoFocus
                aria-label="Jump to entry number"
              />
              <button type="submit">Go</button>
            </form>
          )}
        </div>
        <div className="status-select" role="group" aria-label="Workflow status">
          {STATUSES.map((item) => (
            <button
              key={item}
              className={`status-option ${status === item ? 'active' : ''}`}
              disabled={!writable}
              onClick={() => onStatusChange(item)}
            >
              {friendlyStatus(item)}
            </button>
          ))}
        </div>
      </div>

      <div className="editor-scroll">
        <section className="source-section">
          <div className="section-label-row">
            <span className="section-label">Source</span>
            <button className="link-button" onClick={copySource} title="Copy source">{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="source-text" dir={direction === 'auto' ? undefined : direction}>
            <ProtectedSource text={source} profileId={tokenProfileId} />
          </div>
          {(entry?.context || entry?.notes) && (
            <div className="source-context">
              {entry.context && <p><strong>Context:</strong> {entry.context}</p>}
              {entry.notes && <p><strong>Notes:</strong> {entry.notes}</p>}
            </div>
          )}
        </section>

        <section className="translation-section">
          <div className="section-label-row">
            <span className="section-label">Translation</span>
            {!writable && <span className="readonly-badge">Read only</span>}
          </div>
          <textarea
            ref={textareaRef}
            className={`translation-editor direction-${direction}`}
            dir={direction === 'auto' ? undefined : direction}
            value={translation}
            onChange={(event) => onTranslationChange(event.target.value)}
            readOnly={!writable}
            placeholder="Write a translation…"
            aria-label="Translation"
          />
          {issues.length > 0 && (
            <div className="inline-qa">
              {issues.map((issue, i) => (
                <div key={i} className={`inline-qa-item qa-${issue.severity}`}>{issue.message}</div>
              ))}
            </div>
          )}
        </section>

        <MachineTranslationPanel sourceText={source} sourceLocale={sourceLocale} targetLocale={targetLocale} />
      </div>

      <div className="editor-footer">
        <button className="nav-button" onClick={onPrevUntranslated} disabled={!writable}>Previous Untranslated</button>
        <span className="editor-hint">Ctrl+S save · Alt+↓/↑ navigate</span>
        <button className="nav-button nav-primary" onClick={onNextUntranslated} disabled={!writable}>Next Untranslated</button>
      </div>
    </div>
  )
}
