import {
  useEffect,
} from 'react'

import './Toast.css'

export type ToastType =
  | 'success'
  | 'error'
  | 'info'
  | 'warning'

export type ToastMessage = {
  id: number

  type:
    ToastType

  message:
    string
}

type ToastProps = {
  toast:
    ToastMessage | null

  onClose:
    () => void
}

function Toast({
  toast,
  onClose,
}: ToastProps) {
  useEffect(
    () => {
      if (!toast) {
        return
      }

      const timeout =
        window.setTimeout(
          () => {
            onClose()
          },
          3200,
        )

      return () => {
        window.clearTimeout(
          timeout,
        )
      }
    },
    [
      toast,
      onClose,
    ],
  )

  if (!toast) {
    return null
  }

  return (
    <div
      className={
        `toast toast-${toast.type}`
      }
      role="status"
      aria-live="polite"
    >
      <div className="toast-content">
        <span className="toast-indicator" />

        <span className="toast-message">
          {
            toast.message
          }
        </span>
      </div>

      <button
        className="toast-close"
        type="button"
        aria-label="Close notification"
        onClick={
          onClose
        }
      >
        ×
      </button>
    </div>
  )
}

export default Toast