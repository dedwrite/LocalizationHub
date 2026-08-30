// Reuse the existing revocation protocol. Deleting one Cloud Project must not
// leave a live in-memory collaboration copy, or disturb other project rooms.
export function revokeDeletedProjectSessions(sessions, projectId, clearClient, send) {
  for (const [id, session] of sessions) {
    if (session.cloudProjectId !== projectId) continue
    for (const socket of session.sockets) {
      clearClient(socket)
      send(socket, { type: 'membership-revoked', projectId })
    }
    session.sockets.clear()
    sessions.delete(id)
  }
}
