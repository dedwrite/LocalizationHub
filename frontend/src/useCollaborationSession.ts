import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  CollaborationParticipant,
  CollaborationSession,
  HostProjectRequest,
  JoinProjectRequest,
} from './collaborationTypes'

import type {
  CollaborationProjectSnapshot,
  CollaborationServerMessage,
  CollaborationTranslationConflict,
  CollaborationTranslationUpdatePayload,
} from './collaborationProtocol'

import {
  useCollaborationSocket,
} from './useCollaborationSocket'

type UseCollaborationSessionOptions = {
  onProjectRequested?: (
    participantId: string,
  ) => void | Promise<void>

  onProjectSnapshot?: (
    snapshot:
      CollaborationProjectSnapshot,
  ) => void | Promise<void>

  onTranslationUpdate?: (
    update:
      CollaborationTranslationUpdatePayload,
  ) => void | Promise<void>

  onTranslationConflict?: (
    conflict:
      CollaborationTranslationConflict,
  ) => void | Promise<void>
}

export function useCollaborationSession(
  options:
    UseCollaborationSessionOptions = {},
) {
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

  const pendingDisplayNameRef =
    useRef('')

  const onProjectRequestedRef =
    useRef(
      options.onProjectRequested,
    )

  const onProjectSnapshotRef =
    useRef(
      options.onProjectSnapshot,
    )

  const onTranslationUpdateRef =
    useRef(
      options.onTranslationUpdate,
    )

  const onTranslationConflictRef =
    useRef(
      options.onTranslationConflict,
    )

  const requestProjectRef =
    useRef<
      (() => Promise<void>) |
      null
    >(
      null,
    )

  useEffect(
    () => {
      onProjectRequestedRef.current =
        options.onProjectRequested
    },
    [
      options.onProjectRequested,
    ],
  )

  useEffect(
    () => {
      onProjectSnapshotRef.current =
        options.onProjectSnapshot
    },
    [
      options.onProjectSnapshot,
    ],
  )

  useEffect(
    () => {
      onTranslationUpdateRef.current =
        options.onTranslationUpdate
    },
    [
      options.onTranslationUpdate,
    ],
  )

  useEffect(
    () => {
      onTranslationConflictRef.current =
        options.onTranslationConflict
    },
    [
      options.onTranslationConflict,
    ],
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

            window.setTimeout(
              () => {
                void requestProjectRef
                  .current?.()
              },
              0,
            )

            break
          }

          case 'session-resumed': {
            setSession(
              (current) => {
                if (!current) {
                  return current
                }

                return {
                  ...current,

                  sessionId:
                    message.sessionId,

                  connectionStatus:
                    'connected',
                }
              },
            )

            setActionError(
              null,
            )

            setIsSubmitting(
              false,
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

                const exists =
                  current.participants.some(
                    (
                      participant:
                        CollaborationParticipant,
                    ) =>
                      participant.id ===
                      message.participant.id,
                  )

                if (exists) {
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
                      (
                        participant:
                          CollaborationParticipant,
                      ) =>
                        participant.id !==
                        message.participantId,
                    ),
                }
              },
            )

            break
          }

          case 'entry-selection': {
            setSession(
              (current) => {
                if (!current) {
                  return current
                }

                return {
                  ...current,

                  participants:
                    current.participants.map(
                      (
                        participant:
                          CollaborationParticipant,
                      ) =>
                        participant.id ===
                        message.participantId
                          ? {
                              ...participant,

                              selectedEntryId:
                                message.entryId ??
                                undefined,
                            }
                          : participant,
                    ),
                }
              },
            )

            break
          }

          case 'project-requested': {
            void onProjectRequestedRef
              .current?.(
                message.participantId,
              )

            break
          }

          case 'project-snapshot': {
            void onProjectSnapshotRef
              .current?.(
                message.snapshot,
              )

            break
          }

          case 'translation-update': {
            void onTranslationUpdateRef
              .current?.(
                message.update,
              )

            break
          }

          case 'translation-conflict': {
            void onTranslationConflictRef
              .current?.(
                message.conflict,
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

            if (
              message.code ===
                'session-not-found' ||
              message.code ===
                'resume-invalid'
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
      [],
    )

  const {
    status,

    errorMessage:
      socketErrorMessage,

    serverUrl,

    hostSession,
    joinSession,

    leaveSession:
      leaveSocketSession,

    requestProject,
    sendProjectSnapshot,
    sendTranslationUpdate,
    sendEntrySelection,
  } =
    useCollaborationSocket({
      onMessage:
        handleServerMessage,
    })

  /*
   * Keep the session-level connection
   * status synchronized with the actual
   * WebSocket state.
   *
   * During a temporary outage this
   * becomes "reconnecting", then returns
   * to "connected" after resume.
   */
  useEffect(
    () => {
      setSession(
        (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,

            connectionStatus:
              status,
          }
        },
      )
    },
    [
      status,
    ],
  )

  useEffect(
    () => {
      requestProjectRef.current =
        requestProject

      return () => {
        requestProjectRef.current =
          null
      }
    },
    [
      requestProject,
    ],
  )

  const hostProject =
    useCallback(
      async (
        request:
          HostProjectRequest,
      ) => {
        const displayName =
          request.displayName.trim()

        if (!displayName) {
          return
        }

        pendingDisplayNameRef.current =
          displayName

        setActionError(
          null,
        )

        setIsSubmitting(
          true,
        )

        try {
          await hostSession(
            displayName,
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
      },
      [
        hostSession,
      ],
    )

  const joinProject =
    useCallback(
      async (
        request:
          JoinProjectRequest,
      ) => {
        const displayName =
          request.displayName.trim()

        const sessionId =
          request.sessionId
            .trim()
            .toUpperCase()

        if (
          !displayName ||
          !sessionId
        ) {
          return
        }

        pendingDisplayNameRef.current =
          displayName

        setActionError(
          null,
        )

        setIsSubmitting(
          true,
        )

        try {
          await joinSession(
            sessionId,
            displayName,
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
      },
      [
        joinSession,
      ],
    )

  const leaveSession =
    useCallback(
      async () => {
        await leaveSocketSession()

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
      },
      [
        leaveSocketSession,
      ],
    )

  return {
    session,

    status,
    serverUrl,

    actionError,
    socketErrorMessage,
    isSubmitting,

    hostProject,
    joinProject,
    leaveSession,

    requestProject,
    sendProjectSnapshot,
    sendTranslationUpdate,
    sendEntrySelection,
  }
}

export type CollaborationController =
  ReturnType<
    typeof useCollaborationSession
  >