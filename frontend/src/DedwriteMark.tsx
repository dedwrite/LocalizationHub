import {
  openUrl,
} from '@tauri-apps/plugin-opener'

import './DedwriteMark.css'

const DEDWRITE_URL =
  'https://dedwrite.xyz/'

type DedwriteMarkProps = {
  compact?: boolean
}

function DedwriteMark({
  compact = false,
}: DedwriteMarkProps) {
  async function handleOpenDedwrite() {
    try {
      await openUrl(
        DEDWRITE_URL,
      )
    } catch (
      error
    ) {
      console.error(
        'Failed to open DEDWRITE website.',
        error,
      )
    }
  }

  return (
    <div
      className={
        compact
          ? 'dedwrite-mark compact'
          : 'dedwrite-mark'
      }
      aria-label="A DEDWRITE Project"
    >
      <span className="dedwrite-prefix">
        A
      </span>

      <button
        className="dedwrite-link"
        type="button"
        onClick={() => {
          void handleOpenDedwrite()
        }}
        title="Visit dedwrite.xyz"
        aria-label="Visit DEDWRITE website"
      >
        DEDWRITE
      </button>

      <span className="dedwrite-prefix">
        Project
      </span>
    </div>
  )
}

export default DedwriteMark