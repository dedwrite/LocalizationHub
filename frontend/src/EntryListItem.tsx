import {
  memo,
} from 'react'

import type {
  EffectiveEntryWorkflowStatus,
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

  workflowStatus:
    EffectiveEntryWorkflowStatus

  isSelected:
    boolean

  isBulkSelected:
    boolean

  onToggleBulkSelect:
    (id: string) => void

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
  workflowStatus,
  isSelected,
  isBulkSelected,
  onToggleBulkSelect,
  presenceNames = [],
  onSelect,
}: EntryListItemProps) {

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
  } else {
    title =
      `${workflowStatus} · ${entryTitle}`
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
      <span
        role="checkbox"
        aria-checked={isBulkSelected}
        className={`entry-select ${isBulkSelected ? 'selected' : ''}`}
        onClick={(event) => {
          event.stopPropagation()
          onToggleBulkSelect(entry.id)
        }}
      />
      <EntryStatusIndicator
        isProtected={
          isProtected
        }
        hasError={
          hasError
        }
        hasWarning={
          hasWarning
        }

        workflowStatus={
          workflowStatus
        }
      />

      <span className="entry-key">
        {
          entry.key
        }
      </span>

      <span className="entry-source-preview">
        {
          entry.source
            .replace(/\s+/g, ' ')
            .slice(0, 54)
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