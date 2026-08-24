export const COLLABORATION_PROTOCOL_VERSION =
  2

export type CollaborationParticipantPayload = {
  id: string

  displayName: string

  role:
    | 'host'
    | 'guest'

  selectedEntryId?:
    string
}

export type CollaborationProjectSnapshot = {
  projectJson: string

  sourceFileName: string

  sentAt: number
}

export type CollaborationTranslationUpdate = {
  entryId: string

  translation: string

  baseRevision: number
}

export type CollaborationTranslationUpdatePayload = {
  entryId: string

  translation: string

  revision: number

  participantId: string

  updatedAt: number
}

export type CollaborationTranslationConflict = {
  entryId: string

  attemptedTranslation: string

  currentTranslation: string

  currentRevision: number

  participantId: string

  updatedAt: number
}

export type CollaborationEntrySelection = {
  entryId:
    string | null
}

/*
 * Reconnect credentials exist only for
 * the lifetime of the running app.
 *
 * They are never written to .lhproj,
 * localStorage, config files, or logs.
 */
export type CollaborationReconnectCredentials = {
  sessionId: string

  participantId: string

  reconnectToken: string

  role:
    | 'host'
    | 'guest'

  displayName: string
}

export type CollaborationClientMessage =
  | {
      type:
        'host-session'

      protocolVersion:
        number

      displayName:
        string

      cloudProjectId?:
        string
    }
  | {
      type:
        'join-session'

      protocolVersion:
        number

      sessionId:
        string

      inviteToken:
        string

      displayName:
        string
    }
  | {
      type:
        'resume-session'

      protocolVersion:
        number

      sessionId:
        string

      participantId:
        string

      reconnectToken:
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
        'entry-selection'

      selection:
        CollaborationEntrySelection
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

      reconnectToken:
        string

      inviteToken:
        string
    }
  | {
      type:
        'session-joined'

      sessionId:
        string

      participantId:
        string

      reconnectToken:
        string
    }
  | {
      type:
        'session-resumed'

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
        'translation-conflict'

      conflict:
        CollaborationTranslationConflict
    }
  | {
      type:
        'entry-selection'

      participantId:
        string

      entryId:
        string | null
    }
  | {
      type:
        'pong'
    }
  | {
      type:
        'membership-changed'

      projectId:
        string

      role:
        | 'owner'
        | 'editor'
        | 'viewer'
    }
  | {
      type:
        'membership-revoked'

      projectId:
        string
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
        | 'resume-invalid'
        | 'server-error'
        | 'authentication-required'
        | 'membership-required'
        | 'permission-denied'

      message:
        string
    }