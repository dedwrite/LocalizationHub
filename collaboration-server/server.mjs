import {
  randomUUID,
} from 'node:crypto'

import {
  WebSocket,
  WebSocketServer,
} from 'ws'

const PROTOCOL_VERSION = 1

const HOST = '127.0.0.1'
const PORT = 8787

const SESSION_CODE_LENGTH = 6

const SESSION_ALPHABET =
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
      type: 'error',
      code,
      message,
    },
  )
}

function generateSessionId() {
  for (
    let attempt = 0;
    attempt < 100;
    attempt += 1
  ) {
    let code = ''

    for (
      let index = 0;
      index < SESSION_CODE_LENGTH;
      index += 1
    ) {
      const randomIndex =
        Math.floor(
          Math.random() *
            SESSION_ALPHABET.length,
        )

      code +=
        SESSION_ALPHABET[
          randomIndex
        ]
    }

    const sessionId =
      `LH-${code}`

    if (
      !sessions.has(
        sessionId,
      )
    ) {
      return sessionId
    }
  }

  throw new Error(
    'Could not generate a unique session ID.',
  )
}

function normalizeSessionId(
  value,
) {
  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value
    .trim()
    .toUpperCase()
}

function normalizeDisplayName(
  value,
) {
  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value
    .trim()
    .slice(
      0,
      32,
    )
}

function publicParticipant(
  participant,
) {
  return {
    id:
      participant.id,

    displayName:
      participant.displayName,

    role:
      participant.role,
  }
}

function getParticipants(
  session,
) {
  return Array.from(
    session.participants.values(),
  ).map(
    publicParticipant,
  )
}

function broadcast(
  session,
  message,
  exceptSocket = null,
) {
  for (
    const participant
    of session.participants.values()
  ) {
    if (
      participant.socket ===
      exceptSocket
    ) {
      continue
    }

    send(
      participant.socket,
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
      type: 'participants',

      participants:
        getParticipants(
          session,
        ),
    },
  )
}

function clearClient(
  socket,
) {
  clients.set(
    socket,
    {
      participantId:
        null,

      sessionId:
        null,

      role:
        null,

      displayName:
        null,
    },
  )
}

function leaveSession(
  socket,
) {
  const client =
    clients.get(
      socket,
    )

  if (
    !client?.sessionId ||
    !client.participantId
  ) {
    clearClient(
      socket,
    )

    return
  }

  const session =
    sessions.get(
      client.sessionId,
    )

  if (!session) {
    clearClient(
      socket,
    )

    return
  }

  const participantId =
    client.participantId

  const participant =
    session.participants.get(
      participantId,
    )

  session.participants.delete(
    participantId,
  )

  clearClient(
    socket,
  )

  if (
    participant?.role ===
    'host'
  ) {
    for (
      const remainingParticipant
      of session.participants.values()
    ) {
      sendError(
        remainingParticipant.socket,
        'session-not-found',
        'The host left the collaboration session.',
      )

      clearClient(
        remainingParticipant.socket,
      )
    }

    sessions.delete(
      session.id,
    )

    console.log(
      `[session] ended ${session.id}`,
    )

    return
  }

  broadcast(
    session,
    {
      type:
        'participant-left',

      participantId,
    },
  )

  broadcastParticipants(
    session,
  )
}

function validateProtocol(
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

    return false
  }

  return true
}

function handleHostSession(
  socket,
  message,
) {
  if (
    !validateProtocol(
      socket,
      message,
    )
  ) {
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
      'Enter a valid display name.',
    )

    return
  }

  leaveSession(
    socket,
  )

  let sessionId

  try {
    sessionId =
      generateSessionId()
  } catch {
    sendError(
      socket,
      'server-error',
      'Could not create a collaboration session.',
    )

    return
  }

  const participantId =
    randomUUID()

  const participant = {
    id:
      participantId,

    displayName,

    role:
      'host',

    socket,
  }

  const session = {
    id:
      sessionId,

    hostParticipantId:
      participantId,

    participants:
      new Map([
        [
          participantId,
          participant,
        ],
      ]),
  }

  sessions.set(
    sessionId,
    session,
  )

  clients.set(
    socket,
    {
      participantId,
      sessionId,
      role:
        'host',
      displayName,
    },
  )

  send(
    socket,
    {
      type:
        'session-hosted',

      sessionId,
      participantId,
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
    !validateProtocol(
      socket,
      message,
    )
  ) {
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
      'Enter a valid display name.',
    )

    return
  }

  const sessionId =
    normalizeSessionId(
      message.sessionId,
    )

  const session =
    sessions.get(
      sessionId,
    )

  if (!session) {
    sendError(
      socket,
      'session-not-found',
      'That collaboration session does not exist.',
    )

    return
  }

  leaveSession(
    socket,
  )

  const participantId =
    randomUUID()

  const participant = {
    id:
      participantId,

    displayName,

    role:
      'guest',

    socket,
  }

  session.participants.set(
    participantId,
    participant,
  )

  clients.set(
    socket,
    {
      participantId,
      sessionId,
      role:
        'guest',
      displayName,
    },
  )

  send(
    socket,
    {
      type:
        'session-joined',

      sessionId,
      participantId,
    },
  )

  broadcast(
    session,
    {
      type:
        'participant-joined',

      participant:
        publicParticipant(
          participant,
        ),
    },
    socket,
  )

  broadcastParticipants(
    session,
  )

  console.log(
    `[session] ${displayName} joined ${sessionId}`,
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
      'Invalid JSON message.',
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
    case 'host-session': {
      handleHostSession(
        socket,
        message,
      )

      break
    }

    case 'join-session': {
      handleJoinSession(
        socket,
        message,
      )

      break
    }

    case 'leave-session': {
      leaveSession(
        socket,
      )

      break
    }

    case 'ping': {
      send(
        socket,
        {
          type: 'pong',
        },
      )

      break
    }

    default: {
      sendError(
        socket,
        'invalid-message',
        'Unknown collaboration message type.',
      )
    }
  }
}

const server =
  new WebSocketServer({
    host:
      HOST,

    port:
      PORT,

    maxPayload:
      64 * 1024,
  })

server.on(
  'connection',
  (socket) => {
    clearClient(
      socket,
    )

    console.log(
      '[client] connected',
    )

    socket.on(
      'message',
      (data) => {
        handleMessage(
          socket,
          data,
        )
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
        // Keep socket errors quiet for now.
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

    console.log('')
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
      `[server] ${error.message}`,
    )
  },
)