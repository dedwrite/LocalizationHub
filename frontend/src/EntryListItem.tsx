import {
  memo,
} from 'react'

import type {
  ParsedLocalizationEntry,
} from '@localizationhub/core'

import EntryStatusIndicator from './EntryStatusIndicator'

type EntryListItemProps = {
  entry:
    ParsedLocalizationEntry

  isProtected:
    boolean

  hasError:
    boolean

  hasWarning:
    boolean

  isSelected:
    boolean

  presenceNames?:
    string[]

  onSelect:
    (
      id: string,
    ) => void
}

function EntryListItem({
  entry,
  isProtected,
  hasError,
  hasWarning,
  isSelected,
  presenceNames = [],
  onSelect,
}: EntryListItemProps) {
  const isTranslated =
    !isProtected &&
    entry.translation
      .trim() !== ''

  const entryTitle =
    entry.context
      ? `${entry.context} · ${entry.key}`
      : entry.key

  let title =
    entryTitle

  if (
    isProtected
  ) {
    title =
      `Protected · ${entryTitle}`
  } else if (
    hasError
  ) {
    title =
      `Token Error · ${entryTitle}`
  } else if (
    hasWarning
  ) {
    title =
      `Token Warning · ${entryTitle}`
  } else if (
    isTranslated
  ) {
    title =
      `Translated · ${entryTitle}`
  } else {
    title =
      `Untranslated · ${entryTitle}`
  }

  if (
    presenceNames.length > 0
  ) {
    title +=
      ` · Viewing: ${
        presenceNames.join(
          ', ',
        )
      }`
  }

  const visiblePresence =
    presenceNames.slice(
      0,
      3,
    )

  const hiddenPresenceCount =
    Math.max(
      0,
      presenceNames.length -
        visiblePresence.length,
    )

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
        title
      }
      onClick={() =>
        onSelect(
          entry.id,
        )
      }
    >
      <EntryStatusIndicator
        isProtected={
          isProtected
        }
        isTranslated={
          isTranslated
        }
        hasError={
          hasError
        }
        hasWarning={
          hasWarning
        }
      />

      <span className="entry-key">
        {
          entry.key
        }
      </span>

      {
        presenceNames.length >
          0 && (
          <span
            className="entry-presence"
            aria-label={
              `Viewing: ${
                presenceNames.join(
                  ', ',
                )
              }`
            }
          >
            {
              visiblePresence.map(
                (
                  displayName,
                  index,
                ) => (
                  <span
                    className="entry-presence-avatar"
                    key={
                      `${displayName}-${index}`
                    }
                    title={
                      displayName
                    }
                  >
                    {
                      displayName
                        .trim()
                        .slice(
                          0,
                          1,
                        )
                        .toUpperCase() ||
                      '?'
                    }
                  </span>
                ),
              )
            }

            {
              hiddenPresenceCount >
                0 && (
                <span
                  className="entry-presence-more"
                  title={
                    presenceNames
                      .slice(
                        3,
                      )
                      .join(
                        ', ',
                      )
                  }
                >
                  +
                  {
                    hiddenPresenceCount
                  }
                </span>
              )
            }
          </span>
        )
      }
    </button>
  )
}

export default memo(
  EntryListItem,
)