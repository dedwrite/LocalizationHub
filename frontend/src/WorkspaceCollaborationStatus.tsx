import {
  useState,
} from 'react'

import type {
  CollaborationSession,
} from './collaborationTypes'

import type {
  CollaborationSocketStatus,
} from './useCollaborationSocket'

import type {
  ParsedLocalizationEntry,
} from '@localizationhub/core'

import './WorkspaceCollaborationStatus.css'

type WorkspaceCollaborationStatusProps = {
  session:
    CollaborationSession

  status:
    CollaborationSocketStatus

  entries:
    ParsedLocalizationEntry[]

  onSelectEntry:
    (
      entryId: string,
    ) => void

  onLeave:
    () => void | Promise<void>
}

function WorkspaceCollaborationStatus({
  session,
  status,
  entries,
  onSelectEntry,
  onLeave,
}: WorkspaceCollaborationStatusProps) {
  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false)

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'reconnecting'
        ? 'Reconnecting…'
        : status === 'connecting'
          ? 'Connecting…'
          : status === 'error'
            ? 'Connection Error'
            : 'Disconnected'

  function getEntryLabel(
    entryId:
      string | undefined,
  ) {
    if (!entryId) {
      return 'No entry selected'
    }

    const entry =
      entries.find(
        (candidate) =>
          candidate.id ===
          entryId,
      )

    if (!entry) {
      return 'Unknown entry'
    }

    return (
      entry.context
        ? `${entry.context} · ${entry.key}`
        : entry.key
    )
  }

  function canNavigateToEntry(
    entryId:
      string | undefined,
  ) {
    if (!entryId) {
      return false
    }

    return entries.some(
      (entry) =>
        entry.id ===
        entryId,
    )
  }

  return (
    <div className="workspace-collaboration">
      <button
        type="button"
        className={
          `workspace-collaboration-status ${status}`
        }
        title="Show collaboration participants"
        aria-expanded={
          isOpen
        }
        onClick={() => {
          setIsOpen(
            (current) =>
              !current,
          )
        }}
      >
        <span
          className={
            `workspace-collaboration-dot ${status}`
          }
        />

        <span className="workspace-collaboration-session">
          {
            session.sessionId
          }
        </span>

        <span className="workspace-collaboration-role">
          {
            session.role ===
            'host'
              ? 'Host'
              : 'Guest'
          }
        </span>

        <span className="workspace-collaboration-participants">
          {
            session
              .participants
              .length
          }

          {
            session
              .participants
              .length ===
            1
              ? ' person'
              : ' people'
          }
        </span>
      </button>

      {
        isOpen && (
          <div className="workspace-collaboration-popover">
            <div className="workspace-collaboration-popover-header">
              <div>
                <span>
                  Collaboration
                </span>

                <strong>
                  {
                    session.sessionId
                  }
                </strong>
              </div>

              <span
                className={
                  `workspace-collaboration-connection ${status}`
                }
              >
                {
                  statusLabel
                }
              </span>
            </div>

            <div className="workspace-collaboration-people">
              {
                session
                  .participants
                  .map(
                    (
                      participant,
                    ) => {
                      const canNavigate =
                        canNavigateToEntry(
                          participant
                            .selectedEntryId,
                        )

                      return (
                        <button
                          type="button"
                          className={
                            `workspace-collaboration-person ${
                              canNavigate
                                ? 'navigable'
                                : ''
                            }`
                          }
                          key={
                            participant.id
                          }
                          disabled={
                            !canNavigate
                          }
                          title={
                            canNavigate
                              ? `Go to ${getEntryLabel(
                                  participant
                                    .selectedEntryId,
                                )}`
                              : getEntryLabel(
                                  participant
                                    .selectedEntryId,
                                )
                          }
                          onClick={() => {
                            const entryId =
                              participant
                                .selectedEntryId

                            if (
                              !entryId ||
                              !canNavigate
                            ) {
                              return
                            }

                            onSelectEntry(
                              entryId,
                            )

                            setIsOpen(
                              false,
                            )
                          }}
                        >
                          <span className="workspace-collaboration-person-avatar">
                            {
                              participant
                                .displayName
                                .trim()
                                .slice(
                                  0,
                                  1,
                                )
                                .toUpperCase() ||
                              '?'
                            }
                          </span>

                          <span className="workspace-collaboration-person-info">
                            <span>
                              <strong>
                                {
                                  participant
                                    .displayName
                                }
                              </strong>

                              <span>
                                {
                                  participant
                                    .role ===
                                  'host'
                                    ? 'Host'
                                    : 'Guest'
                                }
                              </span>
                            </span>

                            <small>
                              {
                                getEntryLabel(
                                  participant
                                    .selectedEntryId,
                                )
                              }
                            </small>
                          </span>
                        </button>
                      )
                    },
                  )
              }
            </div>

            <button
              type="button"
              className="workspace-collaboration-leave"
              onClick={() => {
                setIsOpen(
                  false,
                )

                void onLeave()
              }}
            >
              Leave Session
            </button>
          </div>
        )
      }
    </div>
  )
}

export default WorkspaceCollaborationStatus