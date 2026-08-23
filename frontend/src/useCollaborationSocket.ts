import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  COLLABORATION_PROTOCOL_VERSION,
  type CollaborationClientMessage,
  type CollaborationServerMessage,
} from './collaborationProtocol'

const COLLABORATION_SERVER_URL =
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

    connect,
    disconnect,

    hostSession,
    joinSession,
    leaveSession,
  }
}