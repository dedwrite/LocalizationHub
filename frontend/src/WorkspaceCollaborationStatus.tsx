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
} from './parsers'

import './WorkspaceCollaborationStatus.css'

type WorkspaceCollaborationStatusProps = {
  session:
    CollaborationSession

  status:
    CollaborationSocketStatus

  entries:
    ParsedLocalizationEntry[]

  onLeave:
    () => void | Promise<void>
}

function WorkspaceCollaborationStatus({
  session,
  status,
  entries,
  onLeave,
}: WorkspaceCollaborationStatusProps) {
  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false)

  const isConnected =
    status ===
    'connected'

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

  return (
    <div className="workspace-collaboration">
      <button
        type="button"
        className={
          `workspace-collaboration-status ${
            isConnected
              ? 'connected'
              : ''
          }`
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
        <span className="workspace-collaboration-dot" />

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
                  `workspace-collaboration-connection ${
                    isConnected
                      ? 'connected'
                      : ''
                  }`
                }
              >
                {
                  isConnected
                    ? 'Connected'
                    : 'Disconnected'
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
                    ) => (
                      <div
                        className="workspace-collaboration-person"
                        key={
                          participant.id
                        }
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

                        <div className="workspace-collaboration-person-info">
                          <div>
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
                          </div>

                          <small
                            title={
                              getEntryLabel(
                                participant
                                  .selectedEntryId,
                              )
                            }
                          >
                            {
                              getEntryLabel(
                                participant
                                  .selectedEntryId,
                              )
                            }
                          </small>
                        </div>
                      </div>
                    ),
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