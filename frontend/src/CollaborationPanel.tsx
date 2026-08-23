import {
  useCallback,
  useRef,
  useState,
} from 'react'

import type {
  CollaborationParticipant,
  CollaborationSession,
} from './collaborationTypes'

import type {
  CollaborationServerMessage,
} from './collaborationProtocol'

import {
  useCollaborationSocket,
} from './useCollaborationSocket'

import './CollaborationPanel.css'

type CollaborationMode =
  | 'host'
  | 'join'

function CollaborationPanel() {
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
    session,
    setSession,
  ] =
    useState<CollaborationSession | null>(
      null,
    )

  const [
    actionError,
    setActionError,
  ] =
    useState<string | null>(
      null,
    )

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false)

  /*
   * These refs remember what we were
   * trying to do while waiting for the
   * server response.
   */
  const pendingDisplayNameRef =
    useRef('')

  const pendingRoleRef =
    useRef<
      'host' |
      'guest' |
      null
    >(
      null,
    )

  const handleServerMessage =
    useCallback(
      (
        message:
          CollaborationServerMessage,
      ) => {
        switch (
          message.type
        ) {
          case 'session-hosted': {
            setSession({
              sessionId:
                message.sessionId,

              role:
                'host',

              displayName:
                pendingDisplayNameRef.current,

              connectionStatus:
                'connected',

              participants:
                [],
            })

            setIsSubmitting(
              false,
            )

            setActionError(
              null,
            )

            break
          }

          case 'session-joined': {
            setSession({
              sessionId:
                message.sessionId,

              role:
                'guest',

              displayName:
                pendingDisplayNameRef.current,

              connectionStatus:
                'connected',

              participants:
                [],
            })

            setIsSubmitting(
              false,
            )

            setActionError(
              null,
            )

            break
          }

          case 'participants': {
            setSession(
              (current) => {
                if (!current) {
                  return current
                }

                return {
                  ...current,

                  participants:
                    message.participants,
                }
              },
            )

            break
          }

          case 'participant-joined': {
            setSession(
              (current) => {
                if (!current) {
                  return current
                }

                const alreadyExists =
                  current.participants.some(
                    (participant) =>
                      participant.id ===
                      message.participant.id,
                  )

                if (alreadyExists) {
                  return current
                }

                return {
                  ...current,

                  participants: [
                    ...current.participants,
                    message.participant,
                  ],
                }
              },
            )

            break
          }

          case 'participant-left': {
            setSession(
              (current) => {
                if (!current) {
                  return current
                }

                return {
                  ...current,

                  participants:
                    current.participants.filter(
                      (participant) =>
                        participant.id !==
                        message.participantId,
                    ),
                }
              },
            )

            break
          }

          case 'error': {
            setActionError(
              message.message,
            )

            setIsSubmitting(
              false,
            )

            /*
             * If the host ended the room,
             * return the guest to the form.
             */
            if (
              message.code ===
              'session-not-found' &&
              session
            ) {
              setSession(
                null,
              )
            }

            break
          }

          case 'pong': {
            break
          }
        }
      },
      [
        session,
      ],
    )

  const {
    status,
    errorMessage:
      socketErrorMessage,
    hostSession,
    joinSession,
    leaveSession,
  } =
    useCollaborationSocket({
      onMessage:
        handleServerMessage,
    })

  const trimmedName =
    displayName.trim()

  const trimmedSessionId =
    sessionId
      .trim()
      .toUpperCase()

  const canHost =
    trimmedName !== '' &&
    !isSubmitting

  const canJoin =
    trimmedName !== '' &&
    trimmedSessionId !== '' &&
    !isSubmitting

  async function handleHost() {
    if (!canHost) {
      return
    }

    pendingDisplayNameRef.current =
      trimmedName

    pendingRoleRef.current =
      'host'

    setActionError(
      null,
    )

    setIsSubmitting(
      true,
    )

    try {
      await hostSession(
        trimmedName,
      )
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not connect to the collaboration server.'

      setActionError(
        message,
      )

      setIsSubmitting(
        false,
      )
    }
  }

  async function handleJoin() {
    if (!canJoin) {
      return
    }

    pendingDisplayNameRef.current =
      trimmedName

    pendingRoleRef.current =
      'guest'

    setActionError(
      null,
    )

    setIsSubmitting(
      true,
    )

    try {
      await joinSession(
        trimmedSessionId,
        trimmedName,
      )
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not connect to the collaboration server.'

      setActionError(
        message,
      )

      setIsSubmitting(
        false,
      )
    }
  }

  async function handleLeave() {
    await leaveSession()

    setSession(
      null,
    )

    setActionError(
      null,
    )

    setIsSubmitting(
      false,
    )

    pendingDisplayNameRef.current =
      ''

    pendingRoleRef.current =
      null
  }

  if (session) {
    const isHost =
      session.role ===
      'host'

    return (
      <section className="collaboration-panel">
        <div className="collaboration-panel-header">
          <div>
            <span className="collaboration-panel-eyebrow">
              Collaboration
            </span>

            <h2>
              Session Connected
            </h2>

            <p>
              Connected to the
              LocalizationHub collaboration
              relay.
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
              {session.participants.length}
            </strong>
          </div>
        </div>

        <div className="collaboration-participants">
          <span className="collaboration-section-label">
            Participants
          </span>

          {
            session.participants.map(
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
                        participant.displayName
                      }
                    </strong>

                    <span>
                      {
                        participant.role ===
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
          <span className="collaboration-status-dot local" />

          <div>
            <strong>
              Connected
            </strong>

            <span>
              {
                status ===
                'connected'
                  ? 'Connected to ws://127.0.0.1:8787'
                  : 'Connection closed'
              }
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

            setActionError(
              null,
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

            setActionError(
              null,
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

                setActionError(
                  null,
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

                    setActionError(
                      null,
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
                when you connect.
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
              mode ===
              'host'
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
            Local collaboration relay:
            {' '}
            ws://127.0.0.1:8787
          </span>
        </div>
      </div>
    </section>
  )
}

export default CollaborationPanel