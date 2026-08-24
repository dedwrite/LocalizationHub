import {
  useState,
} from 'react'

import type {
  CollaborationParticipant,
} from './collaborationTypes'

import type {
  CollaborationController,
} from './useCollaborationSession'

import './CollaborationPanel.css'

type CollaborationMode =
  | 'host'
  | 'join'

type CollaborationPanelProps = {
  collaboration:
    CollaborationController

  cloudProjectId?:
    string
}

function CollaborationPanel({
  collaboration,

  cloudProjectId,
}: CollaborationPanelProps) {
  const [
    mode,
    setMode,
  ] =
    useState<CollaborationMode>(
      'join',
    )

  const [
    displayName,
    setDisplayName,
  ] =
    useState('')

  const [
    sessionId,
    setSessionId,
  ] =
    useState('')

  const [
    inviteToken,
    setInviteToken,
  ] =
    useState('')

  const {
    session,

    status,
    serverUrl,

    actionError,
    socketErrorMessage,
    isSubmitting,

    hostProject,
    joinProject,
    leaveSession,
  } =
    collaboration

  const trimmedName =
    displayName.trim()

  const trimmedSessionId =
    sessionId
      .trim()
      .toUpperCase()

  const trimmedInviteToken =
    inviteToken
      .trim()
      .toUpperCase()

  const canHost =
    trimmedName !== '' &&
    !isSubmitting

  const canJoin =
    trimmedName !== '' &&
    trimmedSessionId !== '' &&
    trimmedInviteToken !== '' &&
    !isSubmitting

  async function handleHost() {
    if (!canHost) {
      return
    }

    await hostProject({
      displayName:
        trimmedName,

      cloudProjectId,
    })
  }

  async function handleJoin() {
    if (!canJoin) {
      return
    }

    await joinProject({
      sessionId:
        trimmedSessionId,

      inviteToken:
        trimmedInviteToken,

      displayName:
        trimmedName,
    })
  }

  async function handleLeave() {
    await leaveSession()
  }

  if (session) {
    const isHost =
      session.role ===
      'host'

    const isConnected =
      status ===
      'connected'

    const statusHeading =
      status === 'connected'
        ? 'Session Connected'
        : status === 'reconnecting'
          ? 'Session Reconnecting?'
          : status === 'connecting'
            ? 'Session Connecting?'
            : status === 'error'
              ? 'Connection Error'
              : 'Session Disconnected'

    const statusDescription =
      status === 'connected'
        ? 'Connected to the LocalizationHub collaboration relay.'
        : status === 'reconnecting'
          ? 'Connection lost. Reconnecting to the collaboration relay?'
          : status === 'connecting'
            ? 'Connecting to the LocalizationHub collaboration relay?'
            : status === 'error'
              ? 'Could not connect to the collaboration relay.'
              : 'The collaboration connection is currently unavailable.'

    const statusLabel =
      status === 'connected'
        ? 'Connected'
        : status === 'reconnecting'
          ? 'Reconnecting?'
          : status === 'connecting'
            ? 'Connecting?'
            : status === 'error'
              ? 'Connection Error'
              : 'Disconnected'

    return (
      <section className="collaboration-panel">
        <div className="collaboration-panel-header">
          <div>
            <span className="collaboration-panel-eyebrow">
              Collaboration
            </span>

            <h2>
              {statusHeading}
            </h2>

            <p>
              {statusDescription}
            </p>
          </div>

          <span className="collaboration-panel-badge">
            {
              isHost
                ? 'HOST'
                : 'GUEST'
            }
          </span>
        </div>

        <div className="collaboration-session-card">
          <div className="collaboration-session-row">
            <span>
              Session ID
            </span>

            <strong>
              {session.sessionId}
            </strong>
          </div>

          {
            isHost &&
            session.inviteToken && (
              <div className="collaboration-session-row">
                <span>
                  Invite Code
                </span>

                <strong>
                  {session.inviteToken}
                </strong>
              </div>
            )
          }

          <div className="collaboration-session-row">
            <span>
              Your Name
            </span>

            <strong>
              {session.displayName}
            </strong>
          </div>

          <div className="collaboration-session-row">
            <span>
              Role
            </span>

            <strong>
              {
                isHost
                  ? 'Host'
                  : 'Guest'
              }
            </strong>
          </div>

          <div className="collaboration-session-row">
            <span>
              Participants
            </span>

            <strong>
              {
                session
                  .participants
                  .length
              }
            </strong>
          </div>
        </div>

        <div className="collaboration-participants">
          <span className="collaboration-section-label">
            Participants
          </span>

          {
            session
              .participants
              .map(
                (
                  participant:
                    CollaborationParticipant,
                ) => (
                  <div
                    className="collaboration-participant"
                    key={
                      participant.id
                    }
                  >
                    <span className="collaboration-participant-avatar">
                      {
                        participant
                          .displayName
                          .slice(
                            0,
                            1,
                          )
                          .toUpperCase()
                      }
                    </span>

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
                  </div>
                ),
              )
          }
        </div>

        <div className="collaboration-status-preview">
          <span
            className={
              isConnected
                ? 'collaboration-status-dot local'
                : 'collaboration-status-dot'
            }
          />

          <div>
            <strong>
              {
                statusLabel
              }
            </strong>

            <span>
              {serverUrl}
            </span>
          </div>
        </div>

        {
          (
            actionError ||
            socketErrorMessage
          ) && (
            <div
              className="collaboration-host-note"
              role="alert"
            >
              <strong>
                Connection Error
              </strong>

              <span>
                {
                  actionError ??
                  socketErrorMessage
                }
              </span>
            </div>
          )
        }

        <button
          type="button"
          className="collaboration-leave-button"
          onClick={() => {
            void handleLeave()
          }}
        >
          Leave Session
        </button>
      </section>
    )
  }

  return (
    <section className="collaboration-panel">
      <div className="collaboration-panel-header">
        <div>
          <span className="collaboration-panel-eyebrow">
            Collaboration
          </span>

          <h2>
            Work Together
          </h2>

          <p>
            Host a localization session
            or join another translator.
          </p>
        </div>

        <span className="collaboration-panel-badge">
          v0.2
        </span>
      </div>

      <div className="collaboration-mode-switch">
        <button
          type="button"
          className={
            mode === 'join'
              ? 'active'
              : ''
          }
          disabled={
            isSubmitting
          }
          onClick={() => {
            setMode(
              'join',
            )
          }}
        >
          Join Project
        </button>

        <button
          type="button"
          className={
            mode === 'host'
              ? 'active'
              : ''
          }
          disabled={
            isSubmitting
          }
          onClick={() => {
            setMode(
              'host',
            )
          }}
        >
          Host Project
        </button>
      </div>

      <div className="collaboration-form">
        <label>
          <span>
            Display Name
          </span>

          <input
            type="text"
            value={
              displayName
            }
            disabled={
              isSubmitting
            }
            onChange={
              (event) => {
                setDisplayName(
                  event.target.value,
                )
              }
            }
            placeholder="How others will see you"
            maxLength={
              32
            }
            autoComplete="off"
          />
        </label>

        {
          mode === 'join' && (
            <>
              <label>
                <span>
                  Session ID
                </span>

                <input
                  type="text"
                  value={
                    sessionId
                  }
                  disabled={
                    isSubmitting
                  }
                  onChange={
                    (event) => {
                      setSessionId(
                        event.target.value,
                      )
                    }
                  }
                  placeholder="LH-ABC123"
                  autoComplete="off"
                  spellCheck={
                    false
                  }
                />
              </label>

              <label>
                <span>
                  Invite Code
                </span>

                <input
                  type="text"
                  value={
                    inviteToken
                  }
                  disabled={
                    isSubmitting
                  }
                  onChange={
                    (event) => {
                      setInviteToken(
                        event.target.value,
                      )
                    }
                  }
                  placeholder="ABCD-EFGH-JKLM-NPQR"
                  autoComplete="off"
                  spellCheck={
                    false
                  }
                />
              </label>
            </>
          )
        }

        {
          mode === 'host' && (
            <div className="collaboration-host-note">
              <strong>
                Host Session
              </strong>

              <span>
                The relay server will
                generate a session ID
                and invite code when
                you connect.
              </span>
            </div>
          )
        }

        {
          (
            actionError ||
            socketErrorMessage
          ) && (
            <div
              className="collaboration-host-note"
              role="alert"
            >
              <strong>
                Connection Error
              </strong>

              <span>
                {
                  actionError ??
                  socketErrorMessage
                }
              </span>
            </div>
          )
        }

        <button
          type="button"
          className="collaboration-primary-action"
          disabled={
            mode === 'host'
              ? !canHost
              : !canJoin
          }
          onClick={() => {
            if (
              mode === 'host'
            ) {
              void handleHost()
            } else {
              void handleJoin()
            }
          }}
        >
          {
            isSubmitting
              ? 'Connecting...'
              : mode === 'host'
                ? 'Host Project'
                : 'Join Project'
          }
        </button>
      </div>

      <div className="collaboration-status-preview">
        <span className="collaboration-status-dot" />

        <div>
          <strong>
            {
              status ===
              'connecting'
                ? 'Connecting'
                : 'Offline'
            }
          </strong>

          <span>
            {serverUrl}
          </span>
        </div>
      </div>
    </section>
  )
}

export default CollaborationPanel