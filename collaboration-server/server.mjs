import {
  randomUUID,
} from 'node:crypto'

import {
  WebSocket,
  WebSocketServer,
} from 'ws'

const PROTOCOL_VERSION =
  1

const HOST =
  process.env.HOST ??
  '127.0.0.1'

const PORT =
  Number(
    process.env.PORT ??
      8787,
  )

const MAX_PAYLOAD =
  32 * 1024 * 1024

const MAX_SESSION_PARTICIPANTS =
  16

const SESSION_ID_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const sessions =
  new Map()

const clients =
  new Map()

function send(
  socket,
  message,
) {
  if (
    socket.readyState !==
    WebSocket.OPEN
  ) {
    return
  }

  socket.send(
    JSON.stringify(
      message,
    ),
  )
}

function sendError(
  socket,
  code,
  message,
) {
  send(
    socket,
    {
      type:
        'error',

      code,

      message,
    },
  )
}

function createSessionId() {
  for (
    let attempt = 0;
    attempt < 100;
    attempt += 1
  ) {
    let suffix = ''

    for (
      let index = 0;
      index < 6;
      index += 1
    ) {
      const randomIndex =
        Math.floor(
          Math.random() *
            SESSION_ID_ALPHABET.length,
        )

      suffix +=
        SESSION_ID_ALPHABET[
          randomIndex
        ]
    }

    const sessionId =
      `LH-${suffix}`

    if (
      !sessions.has(
        sessionId,
      )
    ) {
      return sessionId
    }
  }

  throw new Error(
    'Could not allocate session ID.',
  )
}

function normalizeDisplayName(
  value,
) {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' ',
      )

  if (
    normalized.length <
      1 ||
    normalized.length >
      32
  ) {
    return null
  }

  return normalized
}

function normalizeSessionId(
  value,
) {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .toUpperCase()

  if (
    !/^LH-[A-Z0-9]{6}$/.test(
      normalized,
    )
  ) {
    return null
  }

  return normalized
}

function getClientState(
  socket,
) {
  return (
    clients.get(
      socket,
    ) ??
    null
  )
}

function getParticipantPayload(
  socket,
) {
  const state =
    getClientState(
      socket,
    )

  if (
    !state ||
    !state.participantId ||
    !state.displayName ||
    !state.role
  ) {
    return null
  }

  return {
    id:
      state.participantId,

    displayName:
      state.displayName,

    role:
      state.role,
  }
}

function getParticipants(
  session,
) {
  const participants =
    []

  for (
    const socket of
      session.sockets
  ) {
    const participant =
      getParticipantPayload(
        socket,
      )

    if (participant) {
      participants.push(
        participant,
      )
    }
  }

  return participants
}

function broadcast(
  session,
  message,
  exceptSocket = null,
) {
  for (
    const socket of
      session.sockets
  ) {
    if (
      socket ===
      exceptSocket
    ) {
      continue
    }

    send(
      socket,
      message,
    )
  }
}

function broadcastParticipants(
  session,
) {
  broadcast(
    session,
    {
      type:
        'participants',

      participants:
        getParticipants(
          session,
        ),
    },
  )
}

function clearClientSession(
  socket,
) {
  const state =
    getClientState(
      socket,
    )

  if (!state) {
    return
  }

  state.sessionId =
    null

  state.role =
    null
}

function leaveSession(
  socket,
) {
  const state =
    getClientState(
      socket,
    )

  if (
    !state ||
    !state.sessionId
  ) {
    return
  }

  const session =
    sessions.get(
      state.sessionId,
    )

  if (!session) {
    clearClientSession(
      socket,
    )

    return
  }

  const leavingParticipantId =
    state.participantId

  const wasHost =
    session.hostSocket ===
    socket

  session.sockets.delete(
    socket,
  )

  clearClientSession(
    socket,
  )

  if (wasHost) {
    sessions.delete(
      session.sessionId,
    )

    for (
      const guestSocket of
        session.sockets
    ) {
      clearClientSession(
        guestSocket,
      )

      sendError(
        guestSocket,
        'session-not-found',
        'The host ended the collaboration session.',
      )
    }

    console.log(
      `[session] ended ${session.sessionId}`,
    )

    return
  }

  if (
    leavingParticipantId
  ) {
    broadcast(
      session,
      {
        type:
          'participant-left',

        participantId:
          leavingParticipantId,
      },
    )
  }

  broadcastParticipants(
    session,
  )
}

function handleHostSession(
  socket,
  message,
) {
  if (
    message.protocolVersion !==
    PROTOCOL_VERSION
  ) {
    sendError(
      socket,
      'unsupported-version',
      'Unsupported collaboration protocol version.',
    )

    return
  }

  const displayName =
    normalizeDisplayName(
      message.displayName,
    )

  if (!displayName) {
    sendError(
      socket,
      'name-invalid',
      'Display name must be between 1 and 32 characters.',
    )

    return
  }

  leaveSession(
    socket,
  )

  const sessionId =
    createSessionId()

  const state =
    getClientState(
      socket,
    )

  state.displayName =
    displayName

  state.role =
    'host'

  state.sessionId =
    sessionId

  const session = {
    sessionId,

    hostSocket:
      socket,

    sockets:
      new Set([
        socket,
      ]),

    /*
     * Server-authoritative revision
     * counter for each translation.
     *
     * Conflict enforcement comes later.
     */
    translationRevisions:
      new Map(),
  }

  sessions.set(
    sessionId,
    session,
  )

  send(
    socket,
    {
      type:
        'session-hosted',

      sessionId,

      participantId:
        state.participantId,
    },
  )

  broadcastParticipants(
    session,
  )

  console.log(
    `[session] hosted ${sessionId}`,
  )
}

function handleJoinSession(
  socket,
  message,
) {
  if (
    message.protocolVersion !==
    PROTOCOL_VERSION
  ) {
    sendError(
      socket,
      'unsupported-version',
      'Unsupported collaboration protocol version.',
    )

    return
  }

  const displayName =
    normalizeDisplayName(
      message.displayName,
    )

  if (!displayName) {
    sendError(
      socket,
      'name-invalid',
      'Display name must be between 1 and 32 characters.',
    )

    return
  }

  const sessionId =
    normalizeSessionId(
      message.sessionId,
    )

  if (!sessionId) {
    sendError(
      socket,
      'session-not-found',
      'Collaboration session was not found.',
    )

    return
  }

  const session =
    sessions.get(
      sessionId,
    )

  if (!session) {
    sendError(
      socket,
      'session-not-found',
      'Collaboration session was not found.',
    )

    return
  }

  if (
    session.sockets.size >=
    MAX_SESSION_PARTICIPANTS
  ) {
    sendError(
      socket,
      'session-full',
      'The collaboration session is full.',
    )

    return
  }

  leaveSession(
    socket,
  )

  const state =
    getClientState(
      socket,
    )

  state.displayName =
    displayName

  state.role =
    'guest'

  state.sessionId =
    sessionId

  session.sockets.add(
    socket,
  )

  send(
    socket,
    {
      type:
        'session-joined',

      sessionId,

      participantId:
        state.participantId,
    },
  )

  const participant =
    getParticipantPayload(
      socket,
    )

  if (participant) {
    broadcast(
      session,
      {
        type:
          'participant-joined',

        participant,
      },
      socket,
    )
  }

  broadcastParticipants(
    session,
  )

  console.log(
    `[session] ${displayName} joined ${sessionId}`,
  )
}

function requireSession(
  socket,
) {
  const state =
    getClientState(
      socket,
    )

  if (
    !state ||
    !state.sessionId
  ) {
    sendError(
      socket,
      'not-in-session',
      'You are not in a collaboration session.',
    )

    return null
  }

  const session =
    sessions.get(
      state.sessionId,
    )

  if (!session) {
    clearClientSession(
      socket,
    )

    sendError(
      socket,
      'session-not-found',
      'Collaboration session was not found.',
    )

    return null
  }

  return {
    state,
    session,
  }
}

function handleProjectRequest(
  socket,
) {
  const context =
    requireSession(
      socket,
    )

  if (!context) {
    return
  }

  const {
    state,
    session,
  } =
    context

  if (
    state.role !==
    'guest'
  ) {
    sendError(
      socket,
      'invalid-message',
      'Only guests can request the project.',
    )

    return
  }

  const hostState =
    getClientState(
      session.hostSocket,
    )

  if (!hostState) {
    sendError(
      socket,
      'session-not-found',
      'The collaboration host is unavailable.',
    )

    return
  }

  send(
    session.hostSocket,
    {
      type:
        'project-requested',

      participantId:
        state.participantId,
    },
  )
}

function handleProjectSnapshot(
  socket,
  message,
) {
  const context =
    requireSession(
      socket,
    )

  if (!context) {
    return
  }

  const {
    state,
    session,
  } =
    context

  if (
    state.role !==
    'host'
  ) {
    sendError(
      socket,
      'host-only',
      'Only the host can send a project snapshot.',
    )

    return
  }

  const snapshot =
    message.snapshot

  if (
    !snapshot ||
    typeof snapshot !==
      'object' ||
    typeof snapshot.projectJson !==
      'string' ||
    typeof snapshot.sourceFileName !==
      'string' ||
    typeof snapshot.sentAt !==
      'number'
  ) {
    sendError(
      socket,
      'invalid-message',
      'Invalid project snapshot.',
    )

    return
  }

  /*
   * The relay does not parse, store,
   * or log project contents.
   */
  broadcast(
    session,
    {
      type:
        'project-snapshot',

      snapshot,
    },
    socket,
  )
}

function handleTranslationUpdate(
  socket,
  message,
) {
  const context =
    requireSession(
      socket,
    )

  if (!context) {
    return
  }

  const {
    state,
    session,
  } =
    context

  const update =
    message.update

  if (
    !update ||
    typeof update !==
      'object' ||
    typeof update.entryId !==
      'string' ||
    update.entryId.length ===
      0 ||
    typeof update.translation !==
      'string' ||
    !Number.isInteger(
      update.baseRevision,
    ) ||
    update.baseRevision <
      0
  ) {
    sendError(
      socket,
      'invalid-message',
      'Invalid translation update.',
    )

    return
  }

  const currentRevision =
    session
      .translationRevisions
      .get(
        update.entryId,
      ) ??
    0

  /*
   * For the first Live Sync pass we
   * accept updates in arrival order.
   *
   * baseRevision is already carried by
   * the protocol, but stale-update
   * rejection is intentionally added
   * later with conflict handling.
   */
  const nextRevision =
    currentRevision +
    1

  session
    .translationRevisions
    .set(
      update.entryId,
      nextRevision,
    )

  broadcast(
    session,
    {
      type:
        'translation-update',

      update: {
        entryId:
          update.entryId,

        translation:
          update.translation,

        revision:
          nextRevision,

        participantId:
          state.participantId,

        updatedAt:
          Date.now(),
      },
    },
  )
}

function handleMessage(
  socket,
  rawData,
) {
  let message

  try {
    message =
      JSON.parse(
        rawData.toString(),
      )
  } catch {
    sendError(
      socket,
      'invalid-message',
      'Invalid collaboration message.',
    )

    return
  }

  if (
    !message ||
    typeof message !==
      'object' ||
    typeof message.type !==
      'string'
  ) {
    sendError(
      socket,
      'invalid-message',
      'Invalid collaboration message.',
    )

    return
  }

  switch (
    message.type
  ) {
    case 'host-session':
      handleHostSession(
        socket,
        message,
      )

      break

    case 'join-session':
      handleJoinSession(
        socket,
        message,
      )

      break

    case 'leave-session':
      leaveSession(
        socket,
      )

      break

    case 'request-project':
      handleProjectRequest(
        socket,
      )

      break

    case 'project-snapshot':
      handleProjectSnapshot(
        socket,
        message,
      )

      break

    case 'translation-update':
      handleTranslationUpdate(
        socket,
        message,
      )

      break

    case 'ping':
      send(
        socket,
        {
          type:
            'pong',
        },
      )

      break

    default:
      sendError(
        socket,
        'invalid-message',
        'Unknown collaboration message.',
      )
  }
}

const server =
  new WebSocketServer({
    host:
      HOST,

    port:
      PORT,

    maxPayload:
      MAX_PAYLOAD,
  })

server.on(
  'connection',
  (socket) => {
    clients.set(
      socket,
      {
        participantId:
          randomUUID(),

        displayName:
          null,

        role:
          null,

        sessionId:
          null,
      },
    )

    console.log(
      '[client] connected',
    )

    socket.on(
      'message',
      (rawData) => {
        try {
          handleMessage(
            socket,
            rawData,
          )
        } catch (error) {
          console.error(
            '[server] message handling failed',
            error,
          )

          sendError(
            socket,
            'server-error',
            'The collaboration server could not process the request.',
          )
        }
      },
    )

    socket.on(
      'close',
      () => {
        leaveSession(
          socket,
        )

        clients.delete(
          socket,
        )

        console.log(
          '[client] disconnected',
        )
      },
    )

    socket.on(
      'error',
      () => {
        /*
         * Do not log message contents,
         * project data, or translations.
         */
      },
    )
  },
)

server.on(
  'listening',
  () => {
    console.log('')
    console.log(
      'LocalizationHub Collaboration Relay',
    )

    console.log(
      `ws://${HOST}:${PORT}`,
    )

    console.log(
      'Waiting for clients...',
    )

    console.log('')
  },
)

server.on(
  'error',
  (error) => {
    console.error(
      '[server] failed',
      error,
    )
  },
)