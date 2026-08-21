import './EntryStatusIndicator.css'
import './ReviewSeverity.css'

type EntryStatusIndicatorProps = {
  isProtected:
    boolean

  isTranslated:
    boolean

  hasError:
    boolean

  hasWarning:
    boolean
}

function EntryStatusIndicator({
  isProtected,
  isTranslated,
  hasError,
  hasWarning,
}: EntryStatusIndicatorProps) {
  let status:
    | 'protected'
    | 'error'
    | 'warning'
    | 'translated'
    | 'untranslated'

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
  } else if (
    isTranslated
  ) {
    status =
      'translated'

    label =
      'Translated'
  } else {
    status =
      'untranslated'

    label =
      'Untranslated'
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