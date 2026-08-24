import {
  useEffect,
} from 'react'

import './ConfirmDialog.css'

type ConfirmDialogProps = {
  open:
    boolean

  title:
    string

  message:
    string

  confirmLabel?:
    string

  cancelLabel?:
    string

  destructive?:
    boolean

  busy?:
    boolean

  onConfirm:
    () => void

  onCancel:
    () => void
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel =
    'Confirm',
  cancelLabel =
    'Cancel',
  destructive =
    false,
  busy =
    false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(
    () => {
      if (!open) {
        return
      }

      function handleKeyDown(
        event:
          KeyboardEvent,
      ) {
        if (
          event.key ===
            'Escape' &&
          !busy
        ) {
          onCancel()
        }
      }

      window.addEventListener(
        'keydown',
        handleKeyDown,
      )

      return () => {
        window.removeEventListener(
          'keydown',
          handleKeyDown,
        )
      }
    },

    [
      open,
      busy,
      onCancel,
    ],
  )

  if (!open) {
    return null
  }

  return (
    <div
      className="confirm-dialog-backdrop"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !busy
        ) {
          onCancel()
        }
      }}
    >
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="confirm-dialog-header">
          <strong
            id="confirm-dialog-title"
          >
            {title}
          </strong>

          <button
            type="button"
            className="confirm-dialog-close"
            onClick={
              onCancel
            }
            disabled={
              busy
            }
            aria-label="Close"
          >
            {'\u00D7'}
          </button>
        </div>

        <div className="confirm-dialog-body">
          <p
            id="confirm-dialog-message"
          >
            {message}
          </p>
        </div>

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-cancel"
            onClick={
              onCancel
            }
            disabled={
              busy
            }
            autoFocus
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`confirm-dialog-confirm ${
              destructive
                ? 'is-danger'
                : ''
            }`}
            onClick={
              onConfirm
            }
            disabled={
              busy
            }
          >
            {
              busy
                ? 'Working...'
                : confirmLabel
            }
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
