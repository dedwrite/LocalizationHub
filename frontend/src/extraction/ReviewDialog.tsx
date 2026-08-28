import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/*
 * Reusable desktop detail dialog used by Diagnostics / Sources / Context
 * Mapping. Rendered into document.body via a portal so the parent flex layout
 * can never compress it into a tiny strip (the human "I can't make it bigger"
 * regression).
 *
 * Features:
 *   - Maximize / Restore (full app viewport)
 *   - Close button + Escape key
 *   - focus moves into the panel on open and back to the trigger on close
 *   - optional native CSS resize when not maximized
 */
type Props = {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  maximizable?: boolean
  resizable?: boolean
  className?: string
}

export default function ReviewDialog({
  title,
  open,
  onClose,
  children,
  maximizable = true,
  resizable = true,
  className = '',
}: Props) {
  const [maximized, setMaximized] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Close, resetting the maximize state so the next open starts restored.
  const close = useCallback(() => {
    setMaximized(false)
    onClose()
  }, [onClose])

  // Focus the panel on open; return focus to the previously-focused element
  // on close.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => {
      previouslyFocused?.focus?.()
    }
  }, [open])

  // Escape closes.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return createPortal(
    <div className="review-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        className={`review-dialog ${maximized ? 'maximized' : ''} ${resizable && !maximized ? 'resizable' : ''} ${className}`}
      >
        <header className="review-dialog-header">
          <h2 id="review-dialog-title">{title}</h2>
          <div className="review-dialog-actions">
            {maximizable && (
              <button
                type="button"
                className="er-button er-small"
                onClick={() => setMaximized((v) => !v)}
                aria-label={maximized ? 'Restore' : 'Maximize'}
              >
                {maximized ? 'Restore' : 'Maximize'}
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              className="er-button er-small"
              onClick={close}
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </header>
        <div className="review-dialog-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
