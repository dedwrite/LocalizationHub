export const COLLABORATION_PROTOCOL_VERSION = 1

export type CollaborationClientMessage =
  | {
      type: 'host-session'
      protocolVersion: number
      displayName: string
    }
  | {
      type: 'join-session'
      protocolVersion: number
      sessionId: string
      displayName: string
    }
  | {
      type: 'leave-session'
    }
  | {
      type: 'ping'
    }

export type CollaborationServerMessage =
  | {
      type: 'session-hosted'
      sessionId: string
      participantId: string
    }
  | {
      type: 'session-joined'
      sessionId: string
      participantId: string
    }
  | {
      type: 'participant-joined'
      participant: {
        id: string
        displayName: string
        role: 'host' | 'guest'
      }
    }
  | {
      type: 'participant-left'
      participantId: string
    }
  | {
      type: 'participants'
      participants: Array<{
        id: string
        displayName: string
        role: 'host' | 'guest'
      }>
    }
  | {
      type: 'pong'
    }
  | {
      type: 'error'
      code:
        | 'invalid-message'
        | 'unsupported-version'
        | 'session-not-found'
        | 'session-full'
        | 'name-invalid'
        | 'server-error'
      message: string
    }