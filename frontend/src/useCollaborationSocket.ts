import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  COLLABORATION_PROTOCOL_VERSION,
  type CollaborationClientMessage,
  type CollaborationEntrySelection,
  type CollaborationProjectSnapshot,
  type CollaborationReconnectCredentials,
  type CollaborationServerMessage,
  type CollaborationTranslationUpdate,
} from './collaborationProtocol'

const COLLABORATION_SERVER_URL =
  import.meta.env
    .VITE_COLLABORATION_SERVER_URL
    ?.trim() ||
  (
    import.meta.env.PROD
      ? 'wss://localizationhub-relay.onrender.com'
      : 'ws://127.0.0.1:8787'
  )

const RECONNECT_DELAY_MS =
  750

const RESUME_TIMEOUT_MS =
  3_000

export type CollaborationSocketStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

type CollaborationSocketOptions = {
  onMessage?: (
    message:
      CollaborationServerMessage,
  ) => void
}

type PendingIdentity = {
  role:
    | 'host'
    | 'guest'

  displayName:
    string
}

type QueuedMessage = {
  message:
    CollaborationClientMessage

  resolve:
    () => void

  reject:
    (
      error: Error,
    ) => void
}

export function useCollaborationSocket(
  options:
    CollaborationSocketOptions = {},
) {
  const socketRef =
    useRef<WebSocket | null>(
      null,
    )

  const onMessageRef =
    useRef(
      options.onMessage,
    )

  /*
   * Reconnect credentials live only
   * in memory for this app process.
   */
  const reconnectCredentialsRef =
    useRef<
      CollaborationReconnectCredentials |
      null
    >(
      null,
    )

  const pendingIdentityRef =
    useRef<
      PendingIdentity |
      null
    >(
      null,
    )

  const reconnectTimerRef =
    useRef<number | null>(
      null,
    )

  const resumeTimeoutRef =
    useRef<number | null>(
      null,
    )

  const reconnectInFlightRef =
    useRef(false)

  const awaitingResumeRef =
    useRef(false)

  const intentionalDisconnectRef =
    useRef(false)

  const reconnectRef =
    useRef<
      (() => Promise<void>) |
      null
    >(
      null,
    )

  const queuedMessagesRef =
    useRef<
      QueuedMessage[]
    >(
      [],
    )

  const [
    status,
    setStatus,
  ] =
    useState<CollaborationSocketStatus>(
      'disconnected',
    )

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    )

  useEffect(
    () => {
      onMessageRef.current =
        options.onMessage
    },
    [
      options.onMessage,
    ],
  )

  const clearReconnectTimer =
    useCallback(
      () => {
        if (
          reconnectTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            reconnectTimerRef.current,
          )

          reconnectTimerRef.current =
            null
        }
      },
      [],
    )

  const clearResumeTimeout =
    useCallback(
      () => {
        if (
          resumeTimeoutRef.current !==
          null
        ) {
          window.clearTimeout(
            resumeTimeoutRef.current,
          )

          resumeTimeoutRef.current =
            null
        }
      },
      [],
    )

  const rejectQueuedMessages =
    useCallback(
      (
        error:
          Error,
      ) => {
        const queued =
          queuedMessagesRef.current

        queuedMessagesRef.current =
          []

        for (
          const item of
            queued
        ) {
          item.reject(
            error,
          )
        }
      },
      [],
    )

  const flushQueuedMessages =
    useCallback(
      (
        socket:
          WebSocket,
      ) => {
        if (
          socket.readyState !==
          WebSocket.OPEN
        ) {
          return
        }

        const queued =
          queuedMessagesRef.current

        queuedMessagesRef.current =
          []

        for (
          const item of
            queued
        ) {
          try {
            socket.send(
              JSON.stringify(
                item.message,
              ),
            )

            item.resolve()
          } catch (
            error
          ) {
            item.reject(
              error instanceof Error
                ? error
                : new Error(
                    'Could not send collaboration message.',
                  ),
            )
          }
        }
      },
      [],
    )

  const scheduleReconnect =
    useCallback(
      () => {
        if (
          reconnectTimerRef.current !==
            null ||
          intentionalDisconnectRef.current ||
          !reconnectCredentialsRef.current
        ) {
          return
        }

        setStatus(
          'reconnecting',
        )

        reconnectTimerRef.current =
          window.setTimeout(
            () => {
              reconnectTimerRef.current =
                null

              void reconnectRef
                .current?.()
            },
            RECONNECT_DELAY_MS,
          )
      },
      [],
    )

  const openSocket =
    useCallback(
      (
        mode:
          | 'normal'
          | 'reconnect',
      ) => {
        return new Promise<WebSocket>(
          (
            resolve,
            reject,
          ) => {
            const existingSocket =
              socketRef.current

            if (
              existingSocket
                ?.readyState ===
              WebSocket.OPEN
            ) {
              resolve(
                existingSocket,
              )

              return
            }

            if (
              existingSocket
                ?.readyState ===
              WebSocket.CONNECTING
            ) {
              reject(
                new Error(
                  'Connection is already in progress.',
                ),
              )

              return
            }

            intentionalDisconnectRef.current =
              false

            if (
              mode ===
              'reconnect'
            ) {
              setStatus(
                'reconnecting',
              )
            } else {
              setStatus(
                'connecting',
              )
            }

            setErrorMessage(
              null,
            )

            const socket =
              new WebSocket(
                COLLABORATION_SERVER_URL,
              )

            socketRef.current =
              socket

            let settled =
              false

            socket.addEventListener(
              'open',
              () => {
                if (
                  mode ===
                  'normal'
                ) {
                  setStatus(
                    'connected',
                  )
                }

                if (!settled) {
                  settled =
                    true

                  resolve(
                    socket,
                  )
                }
              },
            )

            socket.addEventListener(
              'message',
              (event) => {
                if (
                  typeof event.data !==
                  'string'
                ) {
                  return
                }

                try {
                  const message =
                    JSON.parse(
                      event.data,
                    ) as CollaborationServerMessage

                  if (
                    message.type ===
                    'session-hosted'
                  ) {
                    const identity =
                      pendingIdentityRef.current

                    if (identity) {
                      reconnectCredentialsRef.current =
                        {
                          sessionId:
                            message.sessionId,

                          participantId:
                            message.participantId,

                          reconnectToken:
                            message.reconnectToken,

                          role:
                            'host',

                          displayName:
                            identity.displayName,
                        }
                    }

                    reconnectInFlightRef.current =
                      false

                    awaitingResumeRef.current =
                      false

                    clearResumeTimeout()

                    setStatus(
                      'connected',
                    )
                  }

                  if (
                    message.type ===
                    'session-joined'
                  ) {
                    const identity =
                      pendingIdentityRef.current

                    if (identity) {
                      reconnectCredentialsRef.current =
                        {
                          sessionId:
                            message.sessionId,

                          participantId:
                            message.participantId,

                          reconnectToken:
                            message.reconnectToken,

                          role:
                            'guest',

                          displayName:
                            identity.displayName,
                        }
                    }

                    reconnectInFlightRef.current =
                      false

                    awaitingResumeRef.current =
                      false

                    clearResumeTimeout()

                    setStatus(
                      'connected',
                    )
                  }

                  if (
                    message.type ===
                    'session-resumed'
                  ) {
                    reconnectInFlightRef.current =
                      false

                    awaitingResumeRef.current =
                      false

                    clearReconnectTimer()
                    clearResumeTimeout()

                    setErrorMessage(
                      null,
                    )

                    setStatus(
                      'connected',
                    )

                    flushQueuedMessages(
                      socket,
                    )
                  }

                  if (
                    message.type ===
                    'error' &&
                    (
                      message.code ===
                        'resume-invalid' ||
                      message.code ===
                        'session-not-found'
                    )
                  ) {
                    reconnectInFlightRef.current =
                      false

                    awaitingResumeRef.current =
                      false

                    clearReconnectTimer()
                    clearResumeTimeout()

                    reconnectCredentialsRef.current =
                      null

                    setStatus(
                      'error',
                    )

                    setErrorMessage(
                      message.message,
                    )

                    rejectQueuedMessages(
                      new Error(
                        message.message,
                      ),
                    )
                  }

                  onMessageRef.current?.(
                    message,
                  )
                } catch {
                  setErrorMessage(
                    'The collaboration server returned an invalid message.',
                  )
                }
              },
            )

            socket.addEventListener(
              'close',
              () => {
                if (
                  socketRef.current ===
                  socket
                ) {
                  socketRef.current =
                    null
                }

                reconnectInFlightRef.current =
                  false

                awaitingResumeRef.current =
                  false

                clearResumeTimeout()

                if (
                  intentionalDisconnectRef.current
                ) {
                  setStatus(
                    'disconnected',
                  )

                  return
                }

                if (
                  reconnectCredentialsRef.current
                ) {
                  setStatus(
                    'reconnecting',
                  )

                  scheduleReconnect()
                } else {
                  setStatus(
                    'disconnected',
                  )
                }

                if (!settled) {
                  settled =
                    true

                  reject(
                    new Error(
                      'Collaboration connection closed.',
                    ),
                  )
                }
              },
            )

            socket.addEventListener(
              'error',
              () => {
                if (
                  reconnectCredentialsRef.current &&
                  !intentionalDisconnectRef.current
                ) {
                  setStatus(
                    'reconnecting',
                  )
                } else {
                  setStatus(
                    'error',
                  )
                }

                setErrorMessage(
                  'Could not connect to the collaboration server.',
                )

                if (!settled) {
                  settled =
                    true

                  reject(
                    new Error(
                      'Could not connect to the collaboration server.',
                    ),
                  )
                }
              },
            )
          },
        )
      },
      [
        clearReconnectTimer,
        clearResumeTimeout,
        flushQueuedMessages,
        rejectQueuedMessages,
        scheduleReconnect,
      ],
    )

  const attemptReconnect =
    useCallback(
      async () => {
        const credentials =
          reconnectCredentialsRef.current

        if (
          !credentials ||
          intentionalDisconnectRef.current ||
          reconnectInFlightRef.current
        ) {
          return
        }

        reconnectInFlightRef.current =
          true

        try {
          const socket =
            await openSocket(
              'reconnect',
            )

          awaitingResumeRef.current =
            true

          socket.send(
            JSON.stringify({
              type:
                'resume-session',

              protocolVersion:
                COLLABORATION_PROTOCOL_VERSION,

              sessionId:
                credentials.sessionId,

              participantId:
                credentials.participantId,

              reconnectToken:
                credentials.reconnectToken,
            }),
          )

          clearResumeTimeout()

          resumeTimeoutRef.current =
            window.setTimeout(
              () => {
                resumeTimeoutRef.current =
                  null

                if (
                  !awaitingResumeRef.current
                ) {
                  return
                }

                awaitingResumeRef.current =
                  false

                reconnectInFlightRef.current =
                  false

                socket.close()
              },
              RESUME_TIMEOUT_MS,
            )
        } catch {
          reconnectInFlightRef.current =
            false

          scheduleReconnect()
        }
      },
      [
        clearResumeTimeout,
        openSocket,
        scheduleReconnect,
      ],
    )

  useEffect(
    () => {
      reconnectRef.current =
        attemptReconnect

      return () => {
        reconnectRef.current =
          null
      }
    },
    [
      attemptReconnect,
    ],
  )

  const connect =
    useCallback(
      async () => {
        if (
          reconnectCredentialsRef.current
        ) {
          await attemptReconnect()

          const socket =
            socketRef.current

          if (
            socket?.readyState ===
              WebSocket.OPEN &&
            !awaitingResumeRef.current
          ) {
            return socket
          }

          throw new Error(
            'Collaboration session is reconnecting.',
          )
        }

        return openSocket(
          'normal',
        )
      },
      [
        attemptReconnect,
        openSocket,
      ],
    )

  const disconnect =
    useCallback(
      () => {
        intentionalDisconnectRef.current =
          true

        clearReconnectTimer()
        clearResumeTimeout()

        reconnectInFlightRef.current =
          false

        awaitingResumeRef.current =
          false

        reconnectCredentialsRef.current =
          null

        pendingIdentityRef.current =
          null

        rejectQueuedMessages(
          new Error(
            'Collaboration session disconnected.',
          ),
        )

        const socket =
          socketRef.current

        socketRef.current =
          null

        socket?.close()

        setStatus(
          'disconnected',
        )
      },
      [
        clearReconnectTimer,
        clearResumeTimeout,
        rejectQueuedMessages,
      ],
    )

  const send =
    useCallback(
      async (
        message:
          CollaborationClientMessage,
      ) => {
        const socket =
          socketRef.current

        if (
          socket?.readyState ===
            WebSocket.OPEN &&
          !awaitingResumeRef.current
        ) {
          socket.send(
            JSON.stringify(
              message,
            ),
          )

          return
        }

        /*
         * During a temporary disconnect,
         * keep outgoing collaboration
         * updates in RAM until resume
         * succeeds.
         */
        if (
          reconnectCredentialsRef.current
        ) {
          await new Promise<void>(
            (
              resolve,
              reject,
            ) => {
              queuedMessagesRef.current.push({
                message,
                resolve,
                reject,
              })

              scheduleReconnect()
            },
          )

          return
        }

        const connectedSocket =
          await openSocket(
            'normal',
          )

        connectedSocket.send(
          JSON.stringify(
            message,
          ),
        )
      },
      [
        openSocket,
        scheduleReconnect,
      ],
    )

  const hostSession =
    useCallback(
      async (
        displayName:
          string,
      ) => {
        reconnectCredentialsRef.current =
          null

        pendingIdentityRef.current =
          {
            role:
              'host',

            displayName,
          }

        await send({
          type:
            'host-session',

          protocolVersion:
            COLLABORATION_PROTOCOL_VERSION,

          displayName,
        })
      },
      [
        send,
      ],
    )

  const joinSession =
    useCallback(
      async (
        sessionId:
          string,

        inviteToken:
          string,

        displayName:
          string,
      ) => {
        reconnectCredentialsRef.current =
          null

        pendingIdentityRef.current =
          {
            role:
              'guest',

            displayName,
          }

        await send({
          type:
            'join-session',

          protocolVersion:
            COLLABORATION_PROTOCOL_VERSION,

          sessionId,

          inviteToken,

          displayName,
        })
      },
      [
        send,
      ],
    )

  const requestProject =
    useCallback(
      async () => {
        await send({
          type:
            'request-project',
        })
      },
      [
        send,
      ],
    )

  const sendProjectSnapshot =
    useCallback(
      async (
        snapshot:
          CollaborationProjectSnapshot,
      ) => {
        await send({
          type:
            'project-snapshot',

          snapshot,
        })
      },
      [
        send,
      ],
    )

  const sendTranslationUpdate =
    useCallback(
      async (
        update:
          CollaborationTranslationUpdate,
      ) => {
        await send({
          type:
            'translation-update',

          update,
        })
      },
      [
        send,
      ],
    )

  const sendEntrySelection =
    useCallback(
      async (
        selection:
          CollaborationEntrySelection,
      ) => {
        await send({
          type:
            'entry-selection',

          selection,
        })
      },
      [
        send,
      ],
    )

  const leaveSession =
    useCallback(
      async () => {
        intentionalDisconnectRef.current =
          true

        clearReconnectTimer()
        clearResumeTimeout()

        const socket =
          socketRef.current

        if (
          socket?.readyState ===
          WebSocket.OPEN
        ) {
          socket.send(
            JSON.stringify({
              type:
                'leave-session',
            }),
          )
        }

        reconnectCredentialsRef.current =
          null

        pendingIdentityRef.current =
          null

        reconnectInFlightRef.current =
          false

        awaitingResumeRef.current =
          false

        rejectQueuedMessages(
          new Error(
            'Collaboration session ended.',
          ),
        )

        socketRef.current =
          null

        socket?.close()

        setStatus(
          'disconnected',
        )
      },
      [
        clearReconnectTimer,
        clearResumeTimeout,
        rejectQueuedMessages,
      ],
    )

  useEffect(
    () => {
      return () => {
        intentionalDisconnectRef.current =
          true

        clearReconnectTimer()
        clearResumeTimeout()

        const socket =
          socketRef.current

        socketRef.current =
          null

        socket?.close()

        rejectQueuedMessages(
          new Error(
            'Collaboration connection closed.',
          ),
        )
      }
    },
    [
      clearReconnectTimer,
      clearResumeTimeout,
      rejectQueuedMessages,
    ],
  )

  return {
    status,
    errorMessage,

    serverUrl:
      COLLABORATION_SERVER_URL,

    connect,
    disconnect,

    hostSession,
    joinSession,
    leaveSession,

    requestProject,
    sendProjectSnapshot,
    sendTranslationUpdate,
    sendEntrySelection,
  }
}