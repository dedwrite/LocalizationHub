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
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])

  return (
      <dialog ref={dialogRef} className="dialog native-confirm-dialog" role="alertdialog" aria-modal="true" aria-label={title} onCancel={(event) => { event.preventDefault(); onCancel() }} onKeyDown={(event) => event.stopPropagation()}>
        <h2 className="dialog-title">{title}</h2>
        {body && <p className="dialog-body">{body}</p>}
        <div className="dialog-actions">
          <button autoFocus className="dialog-button" onClick={onCancel}>{cancelLabel}</button>
          <button className={`dialog-button ${danger ? 'dialog-button-danger' : 'dialog-button-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </dialog>
  )
}
