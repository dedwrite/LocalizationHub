import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  COLLABORATION_PROTOCOL_VERSION,
  type CollaborationClientMessage,
  type CollaborationProjectSnapshot,
  type CollaborationServerMessage,
  type CollaborationTranslationUpdate,
} from './collaborationProtocol'

/*
 * Default development relay.
 *
 * A different server can be supplied with:
 *
 * VITE_COLLABORATION_SERVER_URL
 *
 * Example:
 * ws://192.168.1.119:8787
 *
 * Production will eventually use
 * a public secure wss:// relay.
 */
const COLLABORATION_SERVER_URL =
  import.meta.env
    .VITE_COLLABORATION_SERVER_URL
    ?.trim() ||
  'ws://127.0.0.1:8787'

export type CollaborationSocketStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

type CollaborationSocketOptions = {
  onMessage?: (
    message:
      CollaborationServerMessage,
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

  const disconnect =
    useCallback(
      () => {
        const socket =
          socketRef.current

        socketRef.current =
          null

        if (socket) {
          socket.close()
        }

        setStatus(
          'disconnected',
        )
      },
      [],
    )

  const connect =
    useCallback(
      () => {
        return new Promise<WebSocket>(
          (
            resolve,
            reject,
          ) => {
            const existingSocket =
              socketRef.current

            if (
              existingSocket?.readyState ===
              WebSocket.OPEN
            ) {
              resolve(
                existingSocket,
              )

              return
            }

            if (
              existingSocket?.readyState ===
              WebSocket.CONNECTING
            ) {
              reject(
                new Error(
                  'Connection is already in progress.',
                ),
              )

              return
            }

            setStatus(
              'connecting',
            )

            setErrorMessage(
              null,
            )

            const socket =
              new WebSocket(
                COLLABORATION_SERVER_URL,
              )

            socketRef.current =
              socket

            socket.addEventListener(
              'open',
              () => {
                setStatus(
                  'connected',
                )

                setErrorMessage(
                  null,
                )

                resolve(
                  socket,
                )
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

                setStatus(
                  'disconnected',
                )
              },
            )

            socket.addEventListener(
              'error',
              () => {
                setStatus(
                  'error',
                )

                setErrorMessage(
                  'Could not connect to the collaboration server.',
                )

                reject(
                  new Error(
                    'Could not connect to the collaboration server.',
                  ),
                )
              },
            )
          },
        )
      },
      [],
    )

  const send =
    useCallback(
      async (
        message:
          CollaborationClientMessage,
      ) => {
        let socket =
          socketRef.current

        if (
          !socket ||
          socket.readyState !==
            WebSocket.OPEN
        ) {
          socket =
            await connect()
        }

        socket.send(
          JSON.stringify(
            message,
          ),
        )
      },
      [
        connect,
      ],
    )

  const hostSession =
    useCallback(
      async (
        displayName:
          string,
      ) => {
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

        displayName:
          string,
      ) => {
        await send({
          type:
            'join-session',

          protocolVersion:
            COLLABORATION_PROTOCOL_VERSION,

          sessionId,

          displayName,
        })
      },
      [
        send,
      ],
    )

  /*
   * Guest asks the host for the
   * currently opened project.
   */
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

  /*
   * Host sends a serialized project
   * snapshot through the relay.
   *
   * The relay forwards it unchanged.
   */
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

  /*
   * Send one translation edit to
   * everyone in the collaboration
   * session through the relay.
   *
   * baseRevision will be used for
   * conflict protection later.
   */
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

  const leaveSession =
    useCallback(
      async () => {
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

        disconnect()
      },
      [
        disconnect,
      ],
    )

  useEffect(
    () => {
      return () => {
        const socket =
          socketRef.current

        socketRef.current =
          null

        socket?.close()
      }
    },
    [],
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
  }
}