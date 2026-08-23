export type CollaborationConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

export type CollaborationRole =
  | 'host'
  | 'guest'

export type CollaborationParticipant = {
  id: string
  displayName: string
  role: CollaborationRole
  selectedEntryId?: string
}

export type CollaborationSession = {
  sessionId: string
  role: CollaborationRole
  displayName: string
  connectionStatus: CollaborationConnectionStatus
  participants: CollaborationParticipant[]
}

export type JoinProjectRequest = {
  sessionId: string
  displayName: string
}

export type HostProjectRequest = {
  displayName: string
}