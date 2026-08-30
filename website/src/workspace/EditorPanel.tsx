import { useEffect, useRef, useState } from 'react'
import { extractProtectedTokens, type EntryContext, type ParsedDialogueContext, type TokenProfileId } from '@localizationhub/core'
import { useI18n, type MessageKey } from '@localizationhub/i18n'
import MachineTranslationPanel from './MachineTranslationPanel'

type EditorPanelProps = {
  entry: any
  extractionContext?: EntryContext
  status: string
  writable: boolean
  tokenProfileId: TokenProfileId
  issues: Array<{ severity: 'error' | 'warning'; message: string }>
  sourceDirection: 'ltr' | 'rtl' | 'auto'
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
  mobile?: boolean
  onNext?: () => void
  onPrev?: () => void
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

/*
 * Compact context strip for the translator: only the fields that are present,
 * never guessed values.
 */
export function DialogueContextStrip({ context }: { context: EntryContext | ParsedDialogueContext }) {
  const { t } = useI18n()
  const genderKeys: Record<string, MessageKey> = {
    male: 'workspace.context.male', female: 'workspace.context.female', neutral: 'workspace.context.neutral',
  }
  const gender = (value?: string) => value && value !== 'unknown'
    ? ` (${genderKeys[value] ? t(genderKeys[value]) : value})` : ''
  const parts: React.ReactNode[] = []
  if (context.speaker) {
    parts.push(<span key="speaker">{t('extraction.context.speaker')} <bdi>{context.speaker}</bdi>{gender(context.speakerGender)}</span>)
  }
  if (context.listeners?.length) {
    parts.push(<span key="listeners">→ {t('extraction.source.listeners')}: {context.listeners.map((name, index) => <span key={index}>{index > 0 && ', '}<bdi>{name}</bdi>{gender(context.listenerGenders?.[index])}</span>)}</span>)
  } else if (context.listener) {
    parts.push(<span key="listener">→ {t('extraction.context.listener')} <bdi>{context.listener}</bdi>{gender(context.listenerGender)}</span>)
  }
  if (context.scene) parts.push(<span key="scene">{t('extraction.context.scene')} <bdi>{context.scene}</bdi></span>)
  if (context.conversationId) parts.push(<span key="conversation">{t('workspace.context.conversation')} <bdi>{context.conversationId}</bdi></span>)
  if (parts.length === 0) return null
  return <p className="dialogue-context-strip" data-i18n-skip>{parts.map((part, index) => <span key={index}>{index > 0 && ' · '}{part}</span>)}</p>
}

export default function EditorPanel(props: EditorPanelProps) {
  const { entry, status, writable, tokenProfileId, issues, sourceDirection, direction, position, total, onTranslationChange, onStatusChange, onNextUntranslated, onPrevUntranslated, onJumpTo, sourceLocale, targetLocale, mobile = false, onNext, onPrev } = props
  const [jumpOpen, setJumpOpen] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const source = entry?.source ?? ''
  const translation = entry?.translation ?? ''
  // Extraction context stays in its canonical metadata location. Both display
  // and MT use the same fallback; explicit parsed context remains authoritative.
  const dialogueContext = entry?.dialogueContext ?? props.extractionContext

  // Concise, proven context for the MT reference request (never paths/guessed).
  const mtContext = {
    speaker: dialogueContext?.speaker,
    listener: dialogueContext?.listener,
    listeners: dialogueContext?.listeners,
    speakerGender: dialogueContext?.speakerGender,
    listenerGender: dialogueContext?.listenerGender,
    listenerGenders: dialogueContext?.listenerGenders,
    scene: dialogueContext?.scene,
    conversationId: dialogueContext?.conversationId,
  }

  useEffect(() => {
    if (entry) setJumpValue(String(position + 1))
  }, [entry, position])

  // On mobile, grow the translation textarea to fit its content so the user
  // never scrolls inside a cramped box; the surface itself scrolls instead.
  useEffect(() => {
    if (!mobile) return
    const element = textareaRef.current
    if (!element) return
    const resize = () => {
      element.style.height = 'auto'
      element.style.height = `${Math.max(120, element.scrollHeight + 2)}px`
    }
    resize()
    element.addEventListener('input', resize)
    return () => element.removeEventListener('input', resize)
  }, [mobile, translation])

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
    <div className={`editor-panel ${mobile ? 'mob-editor' : ''}`}>
      {mobile && (
        <div className="mob-entry-head">
          <span className="mob-entry-key">{entry?.key || entry?.id}</span>
          <span className={`mob-status-pill mob-status-${status}`}>{friendlyStatus(status)}</span>
        </div>
      )}
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
        <div className="status-select" role="group" aria-label="Workflow status" style={mobile ? { display: 'none' } : undefined}>
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
        <div className="editor-content-column">
        <section className="source-section">
          <div className="section-label-row">
            <span className="section-label"><small>REFERENCE</small> Source</span>
            <button className="link-button" onClick={copySource} title="Copy source">{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="source-text" dir={sourceDirection} data-i18n-content>
            <ProtectedSource text={source} profileId={tokenProfileId} />
          </div>
          {(entry?.context || entry?.notes || dialogueContext) && (
            <div className="source-context">
              {dialogueContext && <DialogueContextStrip context={dialogueContext} />}
              {entry.context && <p><strong>Context:</strong> <bdi data-i18n-content>{entry.context}</bdi></p>}
              {entry.notes && <p><strong>Notes:</strong> <bdi data-i18n-content>{entry.notes}</bdi></p>}
            </div>
          )}
        </section>

        <section className="translation-section">
          <div className="section-label-row">
            <span className="section-label translation-label"><small>WORKING COPY</small> Translation</span>
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

        {mobile && (
          <div className="mob-workflow" role="group" aria-label="Workflow status">
            {STATUSES.map((item) => (
              <button
                key={item}
                className={`mob-workflow-option ${status === item ? 'active' : ''}`}
                disabled={!writable}
                onClick={() => onStatusChange(item)}
              >
                {friendlyStatus(item)}
              </button>
            ))}
          </div>
        )}

        <MachineTranslationPanel
          sourceText={source}
          sourceLocale={sourceLocale}
          targetLocale={targetLocale}
          context={mtContext}
        />
        </div>
      </div>

      <div className="editor-footer">
        {mobile ? (
          <>
            <button className="nav-button" onClick={onPrev} disabled={position <= 0}>Previous</button>
            <button className="nav-button nav-primary" onClick={onNextUntranslated} disabled={!writable}>Next Untranslated</button>
            <button className="nav-button" onClick={onNext} disabled={position >= total - 1}>Next</button>
          </>
        ) : (
          <>
            <button className="nav-button" onClick={onPrevUntranslated} disabled={!writable}>Previous Untranslated</button>
            <span className="editor-hint">Ctrl+S save · Alt+↓/↑ navigate</span>
            <button className="nav-button nav-primary" onClick={onNextUntranslated} disabled={!writable}>Next Untranslated</button>
          </>
        )}
      </div>
    </div>
  )
}
