import {
  memo,
} from 'react'

import {
  validateProtectedTokens,
  type TokenProfileId,
} from './tokens'

import type {
  ParsedLocalizationEntry,
} from './parsers'

type EntryListItemProps = {
  entry:
    ParsedLocalizationEntry

  tokenProfile:
    TokenProfileId

  isProtected:
    boolean

  isSelected:
    boolean

  onSelect:
    (id: string) => void
}

function EntryListItem({
  entry,
  tokenProfile,
  isProtected,
  isSelected,
  onSelect,
}: EntryListItemProps) {
  const isTranslated =
    !isProtected &&
    entry.translation
      .trim() !== ''

  /*
   * المهم هنا:
   *
   * الـvalidation صار داخل
   * الـmemoized item نفسه.
   *
   * إذا Entry ثانية تغيرت،
   * React.memo يمنع إعادة
   * validation لهذه الـEntry.
   */
  const validation =
    isProtected ||
    !isTranslated
      ? null
      : validateProtectedTokens(
          entry.source,
          entry.translation,
          tokenProfile,
        )

  const hasTokenError =
    isTranslated &&
    Boolean(
      validation
        ?.hasErrors,
    )

  const hasTokenWarning =
    isTranslated &&
    !hasTokenError &&
    Boolean(
      validation
        ?.hasWarnings,
    )

  let statusClass =
    ''

  if (
    isProtected
  ) {
    statusClass =
      'protected'
  } else if (
    hasTokenError ||
    hasTokenWarning
  ) {
    statusClass =
      'token-warning'
  } else if (
    isTranslated
  ) {
    statusClass =
      'translated'
  }

  const entryTitle =
    entry.context
      ? `${entry.context} · ${entry.key}`
      : entry.key

  return (
    <button
      type="button"
      className={
        `entry-item ${
          isSelected
            ? 'selected'
            : ''
        }`
      }
      title={
        isProtected
          ? `Protected · ${entryTitle}`
          : entryTitle
      }
      onClick={() =>
        onSelect(
          entry.id,
        )
      }
    >
      <span
        className={
          `status-dot ${statusClass}`
        }
      />

      <span className="entry-key">
        {
          entry.key
        }
      </span>
    </button>
  )
}

/*
 * أهم سطر في الملف 😈
 *
 * الـEntries غير المتغيرة
 * ما تعيد render ولا validation.
 */
export default memo(
  EntryListItem,
)