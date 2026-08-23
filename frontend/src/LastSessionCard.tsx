import {
  type LastSession,
} from './lastSession'

import './LastSessionCard.css'

type LastSessionCardProps = {
  session:
    LastSession

  onResume:
    () => void | Promise<void>

  onDismiss:
    () => void
}

function LastSessionCard({
  session,
  onResume,
  onDismiss,
}: LastSessionCardProps) {
  return (
    <section
      className="last-session-card"
      aria-label="Last session"
    >
      <div className="last-session-info">
        <span className="last-session-label">
          Last Session
        </span>

        <strong>
          {session.sourceFileName}
        </strong>
      </div>

      <div className="last-session-actions">
        <button
          className="last-session-resume"
          type="button"
          onClick={() => {
            void onResume()
          }}
        >
          Resume
        </button>

        <button
          className="last-session-dismiss"
          type="button"
          onClick={
            onDismiss
          }
          title="Dismiss last session"
          aria-label="Dismiss last session"
        >
          ×
        </button>
      </div>
    </section>
  )
}

export default LastSessionCard