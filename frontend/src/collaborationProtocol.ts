export const COLLABORATION_PROTOCOL_VERSION =
  1

export type CollaborationParticipantPayload = {
  id: string

  displayName: string

  role:
    | 'host'
    | 'guest'
}

export type CollaborationProjectSnapshot = {
  projectJson: string

  sourceFileName: string

  sentAt: number
}

/*
 * Translation updates carry the revision
 * the sender currently knows about.
 *
 * We are not enforcing conflicts yet,
 * but having this in the protocol now
 * prepares us for revision protection
 * without redesigning the messages later.
 */
export type CollaborationTranslationUpdate = {
  entryId: string

  translation: string

  baseRevision: number
}

/*
 * The relay will eventually become the
 * authority that increments revisions.
 */
export type CollaborationTranslationUpdatePayload = {
  entryId: string

  translation: string

  revision: number

  participantId: string

  updatedAt: number
}

export type CollaborationClientMessage =
  | {
      type:
        'host-session'

      protocolVersion:
        number

      displayName:
        string
    }
  | {
      type:
        'join-session'

      protocolVersion:
        number

      sessionId:
        string

      displayName:
        string
    }
  | {
      type:
        'leave-session'
    }
  | {
      type:
        'project-snapshot'

      snapshot:
        CollaborationProjectSnapshot
    }
  | {
      type:
        'request-project'
    }
  | {
      type:
        'translation-update'

      update:
        CollaborationTranslationUpdate
    }
  | {
      type:
        'ping'
    }

export type CollaborationServerMessage =
  | {
      type:
        'session-hosted'

      sessionId:
        string

      participantId:
        string
    }
  | {
      type:
        'session-joined'

      sessionId:
        string

      participantId:
        string
    }
  | {
      type:
        'participant-joined'

      participant:
        CollaborationParticipantPayload
    }
  | {
      type:
        'participant-left'

      participantId:
        string
    }
  | {
      type:
        'participants'

      participants:
        CollaborationParticipantPayload[]
    }
  | {
      type:
        'project-snapshot'

      snapshot:
        CollaborationProjectSnapshot
    }
  | {
      type:
        'project-requested'

      participantId:
        string
    }
  | {
      type:
        'translation-update'

      update:
        CollaborationTranslationUpdatePayload
    }
  | {
      type:
        'pong'
    }
  | {
      type:
        'error'

      code:
        | 'invalid-message'
        | 'unsupported-version'
        | 'session-not-found'
        | 'session-full'
        | 'name-invalid'
        | 'not-in-session'
        | 'host-only'
        | 'revision-conflict'
        | 'server-error'

      message:
        string
    }