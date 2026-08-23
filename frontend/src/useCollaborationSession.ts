import {
  useState,
} from 'react'

import type {
  CollaborationSession,
  HostProjectRequest,
  JoinProjectRequest,
} from './collaborationTypes'

function generateSessionId() {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  let code = ''

  for (
    let index = 0;
    index < 6;
    index += 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
          alphabet.length,
      )

    code +=
      alphabet[randomIndex]
  }

  return `LH-${code}`
}

function generateParticipantId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return `participant-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

export function useCollaborationSession() {
  const [
    session,
    setSession,
  ] =
    useState<CollaborationSession | null>(
      null,
    )

  function hostProject(
    request:
      HostProjectRequest,
  ) {
    const participantId =
      generateParticipantId()

    const nextSession:
      CollaborationSession = {
      sessionId:
        generateSessionId(),

      role:
        'host',

      displayName:
        request.displayName,

      connectionStatus:
        'connected',

      participants: [
        {
          id:
            participantId,

          displayName:
            request.displayName,

          role:
            'host',
        },
      ],
    }

    setSession(
      nextSession,
    )

    return nextSession
  }

  function joinProject(
    request:
      JoinProjectRequest,
  ) {
    const participantId =
      generateParticipantId()

    const nextSession:
      CollaborationSession = {
      sessionId:
        request.sessionId,

      role:
        'guest',

      displayName:
        request.displayName,

      connectionStatus:
        'connected',

      participants: [
        {
          id:
            participantId,

          displayName:
            request.displayName,

          role:
            'guest',
        },
      ],
    }

    setSession(
      nextSession,
    )

    return nextSession
  }

  function leaveSession() {
    setSession(
      null,
    )
  }

  return {
    session,
    hostProject,
    joinProject,
    leaveSession,
  }
}