import './EntryStatusIndicator.css'
import './ReviewSeverity.css'

import type {
  EffectiveEntryWorkflowStatus,
} from '@localizationhub/core'

type EntryStatusIndicatorProps = {
  isProtected:
    boolean

  hasError:
    boolean

  hasWarning:
    boolean

  workflowStatus:
    EffectiveEntryWorkflowStatus
}

function EntryStatusIndicator({
  isProtected,
  hasError,
  hasWarning,
  workflowStatus,
}: EntryStatusIndicatorProps) {
  let status:
    | 'protected'
    | 'error'
    | 'warning'
    | EffectiveEntryWorkflowStatus

  let label:
    string

  if (
    isProtected
  ) {
    status =
      'protected'

    label =
      'Protected'
  } else if (
    hasError
  ) {
    status =
      'error'

    label =
      'Token error'
  } else if (
    hasWarning
  ) {
    status =
      'warning'

    label =
      'Token warning'
  } else {
    status =
      workflowStatus

    label =
      workflowStatus.replace('-', ' ')
  }

  return (
    <span
      className={
        `entry-status-indicator ${status}`
      }
      title={
        label
      }
      aria-label={
        label
      }
    />
  )
}

export default EntryStatusIndicator