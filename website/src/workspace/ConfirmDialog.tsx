import { useEffect, useRef } from 'react'

type ConfirmDialogProps = {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/*
 * Branded, accessible confirmation dialog replacing window.confirm.
 */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  return (
    <div className="dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog-title">{title}</h2>
        {body && <p className="dialog-body">{body}</p>}
        <div className="dialog-actions">
          <button className="dialog-button" onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} className={`dialog-button ${danger ? 'dialog-button-danger' : 'dialog-button-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
