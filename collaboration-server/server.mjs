import {
  CloudProjectConflictError,
  CloudProjectMemberAlreadyExistsError,
  CloudProjectMemberNotFoundError,
  CloudProjectMemberUserNotFoundError,
  CloudProjectMemberValidationError,
  CloudProjectNotFoundError,
  CloudProjectOwnerImmutableError,
  CloudProjectOwnerRequiredError,
  CloudProjectPermissionError,
  addCloudProjectMember,
  createCloudProject,
  getCloudProject,
  listCloudProjectMembers,
  listCloudProjects,
  removeCloudProjectMember,
  saveCloudProject,
  updateCloudProjectMember,
} from './cloud-projects.mjs'

import {
  AuthError,
  authenticateToken,
  getBearerToken,
  loginUser,
  logoutUser,
  registerUser,
} from './auth.mjs'
import {
  EmailVerificationCooldownError,
  EmailVerificationTokenError,
  EmailVerificationUserNotFoundError,
  discardEmailVerificationToken,
  requestEmailVerification,
  verifyEmailToken,
} from './email-verification.mjs'

import {
  EmailDeliveryConfigurationError,
  EmailDeliveryError,
  sendVerificationEmail,
} from './email-delivery.mjs'
import {
  EMAIL_VERIFICATION_PAGE,
} from './email-verification-page.mjs'

import { randomUUID, randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  createServer,
} from 'node:http'

import {
  WebSocket,
  WebSocketServer,
} from 'ws'

const PROTOCOL_VERSION =
  2


const ENABLE_EXPERIMENTAL_CLOUD_API =
  process.env.ENABLE_EXPERIMENTAL_CLOUD_API ===
  '1'

const CORS_ALLOWED_ORIGINS =
  new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',

    ...(
      process.env.CORS_ALLOWED_ORIGINS ??
      ''
    )
      .split(',')
      .map(
        (origin) =>
          origin.trim(),
      )
      .filter(Boolean),
  ])

const HOST =
  process.env.HOST ??
  '0.0.0.0'

const FAVICON_ICO =
  readFileSync(
    new URL(
      './favicon.ico',
      import.meta.url,
    ),
  )

const APPLE_TOUCH_ICON =
  readFileSync(
    new URL(
      './apple-touch-icon.png',
      import.meta.url,
    ),
  )

const PORT =
  Number(
    process.env.PORT ??
      8787,
  )

const MAX_PAYLOAD =
  32 * 1024 * 1024

const MAX_SESSION_PARTICIPANTS =
  16

const RECONNECT_GRACE_MS =
  15_000

const HEARTBEAT_INTERVAL_MS =
  30_000

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

function createInviteToken() {
  const groups = []

  for (
    let groupIndex = 0;
    groupIndex < 4;
    groupIndex += 1
  ) {
    let group = ''

    for (
      let characterIndex = 0;
      characterIndex < 4;
      characterIndex += 1
    ) {
      const randomIndex =
        randomInt(
          0,
          SESSION_ID_ALPHABET.length,
        )

      group +=
        SESSION_ID_ALPHABET[
          randomIndex
        ]
    }

    groups.push(
      group,
    )
  }

  return groups.join(
    '-',
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

    selectedEntryId:
      state.selectedEntryId ??
      undefined,
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

  if (
    state.reconnectTimer
  ) {
    clearTimeout(
      state.reconnectTimer,
    )

    state.reconnectTimer =
      null
  }

  state.reconnectToken =
    null

  state.disconnectedAt =
    null

  state.selectedEntryId =
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


function scheduleClientDisconnect(
  socket,
) {
  const state =
    getClientState(
      socket,
    )

  if (!state) {
    return
  }

  if (!state.sessionId) {
    clients.delete(
      socket,
    )

    return
  }

  if (
    state.reconnectTimer
  ) {
    clearTimeout(
      state.reconnectTimer,
    )
  }

  state.disconnectedAt =
    Date.now()

  state.reconnectTimer =
    setTimeout(
      () => {
        const currentState =
          getClientState(
            socket,
          )

        if (!currentState) {
          return
        }

        currentState.reconnectTimer =
          null

        leaveSession(
          socket,
        )

        clients.delete(
          socket,
        )

        console.log(
          '[client] reconnect grace expired',
        )
      },
      RECONNECT_GRACE_MS,
    )
}

function handleResumeSession(
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

  const sessionId =
    normalizeSessionId(
      message.sessionId,
    )

  if (
    !sessionId ||
    typeof message.participantId !==
      'string' ||
    !message.participantId ||
    typeof message.reconnectToken !==
      'string' ||
    !message.reconnectToken
  ) {
    sendError(
      socket,
      'resume-invalid',
      'The collaboration session could not be resumed.',
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

  let previousSocket =
    null

  for (
    const candidate of
      session.sockets
  ) {
    const candidateState =
      getClientState(
        candidate,
      )

    if (
      candidateState
        ?.participantId ===
      message.participantId
    ) {
      previousSocket =
        candidate

      break
    }
  }

  if (!previousSocket) {
    sendError(
      socket,
      'resume-invalid',
      'The collaboration participant could not be resumed.',
    )

    return
  }

  const previousState =
    getClientState(
      previousSocket,
    )

  if (
    !previousState ||
    previousState.reconnectToken !==
      message.reconnectToken
  ) {
    sendError(
      socket,
      'resume-invalid',
      'The collaboration reconnect token is invalid.',
    )

    return
  }

  if (
    previousSocket.readyState ===
    WebSocket.OPEN
  ) {
    sendError(
      socket,
      'resume-invalid',
      'This collaboration participant is already connected.',
    )

    return
  }

  if (
    previousState.reconnectTimer
  ) {
    clearTimeout(
      previousState.reconnectTimer,
    )
  }

  previousState.reconnectTimer =
    null

  previousState.disconnectedAt =
    null

  clients.delete(
    previousSocket,
  )

  clients.set(
    socket,
    previousState,
  )

  session.sockets.delete(
    previousSocket,
  )

  session.sockets.add(
    socket,
  )

  if (
    session.hostSocket ===
    previousSocket
  ) {
    session.hostSocket =
      socket
  }

  send(
    socket,
    {
      type:
        'session-resumed',

      sessionId,

      participantId:
        previousState.participantId,
    },
  )

  broadcastParticipants(
    session,
  )

  console.log(
    `[session] resumed ${sessionId}`,
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

  const inviteToken =
    createInviteToken()

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

  state.reconnectToken =
    randomUUID()

  state.reconnectTimer =
    null

  state.disconnectedAt =
    null

  const session = {
    sessionId,

    inviteToken,

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

    translationValues:
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

      reconnectToken:
        state.reconnectToken,

      inviteToken,
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

  const inviteToken =
    typeof message.inviteToken ===
      'string'
      ? message.inviteToken
          .trim()
          .toUpperCase()
      : ''

  if (
    !session ||
    !inviteToken ||
    inviteToken !==
      session.inviteToken
  ) {
    sendError(
      socket,
      'session-not-found',
      'Session ID or invite code is invalid.',
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

  state.reconnectToken =
    randomUUID()

  state.reconnectTimer =
    null

  state.disconnectedAt =
    null

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

      reconnectToken:
        state.reconnectToken,
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
   * Reject stale edits.
   *
   * The client may only update the
   * revision it currently knows.
   */
  if (
    update.baseRevision !==
    currentRevision
  ) {
    const latest =
      session
        .translationValues
        .get(
          update.entryId,
        )

    if (!latest) {
      sendError(
        socket,
        'revision-conflict',
        'This translation changed before your edit could be applied.',
      )

      return
    }

    send(
      socket,
      {
        type:
          'translation-conflict',

        conflict: {
          entryId:
            update.entryId,

          attemptedTranslation:
            update.translation,

          currentTranslation:
            latest.translation,

          currentRevision,

          participantId:
            latest.participantId,

          updatedAt:
            latest.updatedAt,
        },
      },
    )

    return
  }

  const nextRevision =
    currentRevision +
    1

  const updatedAt =
    Date.now()

  session
    .translationRevisions
    .set(
      update.entryId,
      nextRevision,
    )

  session
    .translationValues
    .set(
      update.entryId,
      {
        translation:
          update.translation,

        participantId:
          state.participantId,

        updatedAt,
      },
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

        updatedAt,
      },
    },
  )
}

function handleEntrySelection(
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

  const selection =
    message.selection

  if (
    !selection ||
    typeof selection !==
      'object' ||
    (
      selection.entryId !==
        null &&
      typeof selection.entryId !==
        'string'
    )
  ) {
    sendError(
      socket,
      'invalid-message',
      'Invalid entry selection.',
    )

    return
  }

  state.selectedEntryId =
    selection.entryId

  broadcast(
    session,
    {
      type:
        'entry-selection',

      participantId:
        state.participantId,

      entryId:
        state.selectedEntryId,
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
    case 'resume-session':
      handleResumeSession(
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
    case 'entry-selection':
      handleEntrySelection(
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

function applyCorsHeaders(
  request,
  response,
) {
  const origin =
    request.headers.origin

  if (
    !origin ||
    !CORS_ALLOWED_ORIGINS.has(
      origin,
    )
  ) {
    return false
  }

  response.setHeader(
    'Access-Control-Allow-Origin',
    origin,
  )

  response.setHeader(
    'Vary',
    'Origin',
  )

  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  )

  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )

  return true
}

function sendJson(
  response,
  statusCode,
  value,
) {
  const body =
    JSON.stringify(
      value,
    )

  response.writeHead(
    statusCode,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Content-Length':
        Buffer.byteLength(
          body,
        ),

      'Cache-Control':
        'no-store',
    },
  )

  response.end(
    body,
  )
}

function sendAuthError(
  response,
  error,
) {
  if (
    !(error instanceof AuthError)
  ) {
    console.error(
      'Authentication request failed:',
      error,
    )

    sendJson(
      response,
      500,
      {
        error:
          'internal-error',

        message:
          'Authentication service encountered an internal error.',
      },
    )

    return
  }

  let statusCode =
    400

  if (
    error.code ===
      'username-taken' ||
    error.code ===
      'email-taken'
  ) {
    statusCode =
      409
  } else if (
    error.code ===
      'invalid-credentials'
  ) {
    statusCode =
      401
  }

  sendJson(
    response,
    statusCode,
    {
      error:
        error.code,

      message:
        error.message,
    },
  )
}

function sendEmailVerificationError(
  response,
  error,
) {
  if (
    error instanceof
      EmailVerificationCooldownError
  ) {
    response.setHeader(
      'Retry-After',
      String(
        error.retryAfterSeconds,
      ),
    )

    sendJson(
      response,
      429,
      {
        error:
          'verification-cooldown',

        message:
          error.message,

        retryAfterSeconds:
          error.retryAfterSeconds,
      },
    )

    return
  }

  if (
    error instanceof
      EmailVerificationTokenError
  ) {
    const statusCode =
      error.code ===
        'verification-token-expired'
        ? 410
        : 400

    sendJson(
      response,
      statusCode,
      {
        error:
          error.code,

        message:
          error.message,
      },
    )

    return
  }

  if (
    error instanceof
      EmailVerificationUserNotFoundError
  ) {
    sendJson(
      response,
      401,
      {
        error:
          'unauthorized',

        message:
          'Authentication is required.',
      },
    )

    return
  }

  if (
    error instanceof
      EmailDeliveryConfigurationError ||
    error instanceof
      EmailDeliveryError
  ) {
    console.error(
      'Verification email delivery failed:',
      error,
    )

    sendJson(
      response,
      503,
      {
        error:
          'email-delivery-unavailable',

        message:
          'Verification email could not be sent right now.',
      },
    )

    return
  }

  console.error(
    'Email verification request failed:',
    error,
  )

  sendJson(
    response,
    500,
    {
      error:
        'internal-error',

      message:
        'Email verification encountered an internal error.',
    },
  )
}


function sendCloudProjectMembershipError(
  response,
  error,
) {
  if (
    error instanceof
      CloudProjectNotFoundError
  ) {
    sendJson(
      response,
      404,
      {
        error:
          'project-not-found',
      },
    )

    return true
  }

  if (
    error instanceof
      CloudProjectOwnerRequiredError
  ) {
    sendJson(
      response,
      403,
      {
        error:
          'project-owner-required',

        message:
          'Only the Cloud Project owner can manage members.',
      },
    )

    return true
  }

  if (
    error instanceof
      CloudProjectOwnerImmutableError
  ) {
    sendJson(
      response,
      409,
      {
        error:
          'project-owner-immutable',

        message:
          'The Cloud Project owner cannot be modified or removed.',
      },
    )

    return true
  }

  if (
    error instanceof
      CloudProjectMemberNotFoundError
  ) {
    sendJson(
      response,
      404,
      {
        error:
          'project-member-not-found',
      },
    )

    return true
  }

  if (
    error instanceof
      CloudProjectMemberUserNotFoundError
  ) {
    sendJson(
      response,
      404,
      {
        error:
          'project-member-user-not-found',

        message:
          'No account exists with that username.',
      },
    )

    return true
  }

  if (
    error instanceof
      CloudProjectMemberAlreadyExistsError
  ) {
    sendJson(
      response,
      409,
      {
        error:
          'project-member-already-exists',

        message:
          'This user is already part of the Cloud Project.',
      },
    )

    return true
  }

  if (
    error instanceof
      CloudProjectMemberValidationError
  ) {
    sendJson(
      response,
      400,
      {
        error:
          'invalid-request',

        message:
          error.message,
      },
    )

    return true
  }

  return false
}

async function getAuthenticatedRequest(
  request,
) {
  const token =
    getBearerToken(
      request.headers.authorization,
    )

  if (!token) {
    return null
  }

  const user =
    await authenticateToken(
      token,
    )

  if (!user) {
    return null
  }

  return {
    token,
    user,
  }
}

async function readJsonBody(
  request,
) {
  const chunks = []

  let totalBytes =
    0

  for await (
    const chunk
    of request
  ) {
    totalBytes +=
      chunk.length

    if (
      totalBytes >
      MAX_PAYLOAD
    ) {
      throw new Error(
        'request-too-large',
      )
    }

    chunks.push(
      chunk,
    )
  }

  const text =
    Buffer.concat(
      chunks,
    ).toString(
      'utf8',
    )

  return JSON.parse(
    text,
  )
}

const httpServer =
  createServer(
    async (
      request,
      response,
    ) => {
      const corsAllowed =
        applyCorsHeaders(
          request,
          response,
        )

      if (
        request.method ===
          'OPTIONS'
      ) {
        if (
          request.headers.origin &&
          !corsAllowed
        ) {
          sendJson(
            response,
            403,
            {
              error:
                'cors-origin-not-allowed',
            },
          )

          return
        }

        response.writeHead(
          204,
        )

        response.end()

        return
      }

      if (
        request.url?.startsWith(
          '/api/projects'
        ) &&
        !ENABLE_EXPERIMENTAL_CLOUD_API
      ) {
        sendJson(
          response,
          404,
          {
            error:
              'not-found',

            message:
              'Cloud project API is disabled.',
          },
        )

        return
      }

      if (
        request.url?.startsWith(
          '/api/auth'
        ) &&
        !ENABLE_EXPERIMENTAL_CLOUD_API
      ) {
        sendJson(
          response,
          404,
          {
            error:
              'not-found',

            message:
              'Authentication API is disabled.',
          },
        )

        return
      }

      if (
        request.method ===
          'GET' &&
        request.url ===
          '/apple-touch-icon.png'
      ) {
        response.writeHead(
          200,
          {
            'Content-Type':
              'image/png',

            'Content-Length':
              APPLE_TOUCH_ICON.length,

            'Cache-Control':
              'public, max-age=86400',

            'X-Content-Type-Options':
              'nosniff',
          },
        )

        response.end(
          APPLE_TOUCH_ICON,
        )

        return
      }

      if (
        request.method ===
          'GET' &&
        request.url ===
          '/favicon.ico'
      ) {
        response.writeHead(
          200,
          {
            'Content-Type':
              'image/x-icon',

            'Content-Length':
              FAVICON_ICO.length,

            'Cache-Control':
              'public, max-age=86400',

            'X-Content-Type-Options':
              'nosniff',
          },
        )

        response.end(
          FAVICON_ICO,
        )

        return
      }

      if (
        request.method ===
          'GET' &&
        /^\/verify-email(?:\?|$)/.test(
          request.url ?? ''
        )
      ) {
        response.writeHead(
          200,
          {
            'Content-Type':
              'text/html; charset=utf-8',

            'Content-Length':
              Buffer.byteLength(
                EMAIL_VERIFICATION_PAGE,
              ),

            'Cache-Control':
              'no-store',

            'Referrer-Policy':
              'no-referrer',

            'X-Content-Type-Options':
              'nosniff',

            'Content-Security-Policy':
              "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          },
        )

        response.end(
          EMAIL_VERIFICATION_PAGE,
        )

        return
      }

      if (
        request.method ===
          'GET' &&
        request.url ===
          '/health'
      ) {
        sendJson(
          response,
          200,
          {
            status:
              'ok',

            service:
              'localizationhub-collaboration-relay',

            protocolVersion:
              PROTOCOL_VERSION,
          },
        )

        return
      }

      if (
        request.method ===
          'POST' &&
        request.url ===
          '/api/auth/register'
      ) {
        try {
          const body =
            await readJsonBody(
              request,
            )

          if (
            !body ||
            typeof body !==
              'object'
          ) {
            throw new AuthError(
              'invalid-request',
              'Invalid registration request.',
            )
          }

          const result =
            await registerUser({
              username:
                body.username,

              email:
                body.email,

              password:
                body.password,
            })

          sendJson(
            response,
            201,
            result,
          )
        } catch (
          error
        ) {
          sendAuthError(
            response,
            error,
          )
        }

        return
      }

      if (
        request.method ===
          'POST' &&
        request.url ===
          '/api/auth/login'
      ) {
        try {
          const body =
            await readJsonBody(
              request,
            )

          if (
            !body ||
            typeof body !==
              'object'
          ) {
            throw new AuthError(
              'invalid-credentials',
              'Username or password is incorrect.',
            )
          }

          const result =
            await loginUser({
              username:
                body.username,

              password:
                body.password,
            })

          sendJson(
            response,
            200,
            result,
          )
        } catch (
          error
        ) {
          sendAuthError(
            response,
            error,
          )
        }

        return
      }

      if (
        request.method ===
          'GET' &&
        request.url ===
          '/api/auth/me'
      ) {
        const authenticated =
          await getAuthenticatedRequest(
            request,
          )

        if (!authenticated) {
          sendJson(
            response,
            401,
            {
              error:
                'unauthorized',

              message:
                'Authentication is required.',
            },
          )

          return
        }

        sendJson(
          response,
          200,
          {
            user:
              authenticated.user,
          },
        )

        return
      }

      if (
        request.method ===
          'POST' &&
        request.url ===
          '/api/auth/logout'
      ) {
        const authenticated =
          await getAuthenticatedRequest(
            request,
          )

        if (!authenticated) {
          sendJson(
            response,
            401,
            {
              error:
                'unauthorized',

              message:
                'Authentication is required.',
            },
          )

          return
        }

        await logoutUser(
          authenticated.token,
        )

        sendJson(
          response,
          200,
          {
            ok:
              true,
          },
        )

        return
      }

      if (
        request.method ===
          'POST' &&
        request.url ===
          '/api/auth/verification/send'
      ) {
        const authenticated =
          await getAuthenticatedRequest(
            request,
          )

        if (!authenticated) {
          sendJson(
            response,
            401,
            {
              error:
                'unauthorized',

              message:
                'Authentication is required.',
            },
          )

          return
        }

        try {
          const verification =
            await requestEmailVerification(
              authenticated.user.id,
            )

          if (
            verification.alreadyVerified
          ) {
            sendJson(
              response,
              200,
              {
                ok:
                  true,

                alreadyVerified:
                  true,

                user:
                  verification.user,
              },
            )

            return
          }

          try {
            await sendVerificationEmail({
              email:
                verification.user.email,

              username:
                verification.user.username,

              token:
                verification.token,

              expiresAt:
                verification.expiresAt,
            })
          } catch (
            deliveryError
          ) {
            try {
              await discardEmailVerificationToken(
                verification.token,
              )
            } catch (
              cleanupError
            ) {
              console.error(
                'Verification token cleanup failed:',
                cleanupError,
              )
            }

            throw deliveryError
          }

          sendJson(
            response,
            202,
            {
              ok:
                true,

              alreadyVerified:
                false,

              expiresAt:
                verification.expiresAt,
            },
          )
        } catch (
          error
        ) {
          sendEmailVerificationError(
            response,
            error,
          )
        }

        return
      }

      if (
        request.method ===
          'POST' &&
        request.url ===
          '/api/auth/verification/verify'
      ) {
        let body

        try {
          body =
            await readJsonBody(
              request,
            )
        } catch {
          sendJson(
            response,
            400,
            {
              error:
                'invalid-request',

              message:
                'Invalid email verification request.',
            },
          )

          return
        }

        try {
          if (
            !body ||
            typeof body !==
              'object' ||
            typeof body.token !==
              'string' ||
            body.token.length ===
              0
          ) {
            throw new EmailVerificationTokenError(
              'verification-token-invalid',
              'Email verification token is invalid.',
            )
          }

          const user =
            await verifyEmailToken(
              body.token,
            )

          sendJson(
            response,
            200,
            {
              ok:
                true,

              user,
            },
          )
        } catch (
          error
        ) {
          sendEmailVerificationError(
            response,
            error,
          )
        }

        return
      }

      const cloudAuthentication =
        request.url?.startsWith(
          '/api/projects'
        )
          ? await getAuthenticatedRequest(
              request,
            )
          : null

      if (
        request.url?.startsWith(
          '/api/projects'
        ) &&
        !cloudAuthentication
      ) {
        sendJson(
          response,
          401,
          {
            error:
              'unauthorized',

            message:
              'Authentication is required.',
          },
        )

        return
      }

      if (
        request.url?.startsWith(
          '/api/projects'
        ) &&
        cloudAuthentication &&
        !cloudAuthentication.user.emailVerified
      ) {
        sendJson(
          response,
          403,
          {
            error:
              'email-verification-required',

            message:
              'Verify your email before using Cloud Projects.',
          },
        )

        return
      }

      if (
        request.method ===
          'GET' &&
        request.url ===
          '/api/projects'
      ) {
        sendJson(
          response,
          200,
          {
            projects:
              await listCloudProjects(
                cloudAuthentication.user.id,
              ),
          },
        )

        return
      }

      const projectMembersMatch =
        request.url?.match(
          /^\/api\/projects\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\/members$/
        )

      const projectMemberMatch =
        request.url?.match(
          /^\/api\/projects\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\/members\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/
        )

      if (
        request.method ===
          'GET' &&
        projectMembersMatch
      ) {
        try {
          const projectId =
            projectMembersMatch[1]
              .toLowerCase()

          const members =
            await listCloudProjectMembers(
              projectId,
              cloudAuthentication.user.id,
            )

          sendJson(
            response,
            200,
            {
              members,
            },
          )
        } catch (
          error
        ) {
          if (
            sendCloudProjectMembershipError(
              response,
              error,
            )
          ) {
            return
          }

          console.error(
            'Cloud project member list request failed:',
            error,
          )

          sendJson(
            response,
            500,
            {
              error:
                'internal-error',
            },
          )
        }

        return
      }

      if (
        request.method ===
          'POST' &&
        projectMembersMatch
      ) {
        try {
          const projectId =
            projectMembersMatch[1]
              .toLowerCase()

          const body =
            await readJsonBody(
              request,
            )

          if (
            !body ||
            typeof body !==
              'object' ||
            typeof body.username !==
              'string' ||
            body.username.trim()
              .length === 0 ||
            (
              body.role !==
                'editor' &&
              body.role !==
                'viewer'
            )
          ) {
            sendJson(
              response,
              400,
              {
                error:
                  'invalid-request',
              },
            )

            return
          }

          const member =
            await addCloudProjectMember(
              projectId,
              {
                userId:
                  cloudAuthentication.user.id,

                username:
                  body.username.trim(),

                role:
                  body.role,
              },
            )

          sendJson(
            response,
            201,
            {
              member,
            },
          )
        } catch (
          error
        ) {
          if (
            sendCloudProjectMembershipError(
              response,
              error,
            )
          ) {
            return
          }

          console.error(
            'Cloud project member add request failed:',
            error,
          )

          sendJson(
            response,
            500,
            {
              error:
                'internal-error',
            },
          )
        }

        return
      }

      if (
        request.method ===
          'PATCH' &&
        projectMemberMatch
      ) {
        try {
          const projectId =
            projectMemberMatch[1]
              .toLowerCase()

          const memberUserId =
            projectMemberMatch[2]
              .toLowerCase()

          const body =
            await readJsonBody(
              request,
            )

          if (
            !body ||
            typeof body !==
              'object' ||
            (
              body.role !==
                'editor' &&
              body.role !==
                'viewer'
            )
          ) {
            sendJson(
              response,
              400,
              {
                error:
                  'invalid-request',
              },
            )

            return
          }

          const member =
            await updateCloudProjectMember(
              projectId,
              memberUserId,
              {
                userId:
                  cloudAuthentication.user.id,

                role:
                  body.role,
              },
            )

          sendJson(
            response,
            200,
            {
              member,
            },
          )
        } catch (
          error
        ) {
          if (
            sendCloudProjectMembershipError(
              response,
              error,
            )
          ) {
            return
          }

          console.error(
            'Cloud project member update request failed:',
            error,
          )

          sendJson(
            response,
            500,
            {
              error:
                'internal-error',
            },
          )
        }

        return
      }

      if (
        request.method ===
          'DELETE' &&
        projectMemberMatch
      ) {
        try {
          const projectId =
            projectMemberMatch[1]
              .toLowerCase()

          const memberUserId =
            projectMemberMatch[2]
              .toLowerCase()

          const removed =
            await removeCloudProjectMember(
              projectId,
              memberUserId,
              cloudAuthentication.user.id,
            )

          sendJson(
            response,
            200,
            {
              removedUserId:
                removed.userId,
            },
          )
        } catch (
          error
        ) {
          if (
            sendCloudProjectMembershipError(
              response,
              error,
            )
          ) {
            return
          }

          console.error(
            'Cloud project member remove request failed:',
            error,
          )

          sendJson(
            response,
            500,
            {
              error:
                'internal-error',
            },
          )
        }

        return
      }

      const projectMatch =
        request.url?.match(
          /^\/api\/projects\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/
        )

      if (
        request.method ===
          'GET' &&
        projectMatch
      ) {
        try {
          const projectId =
            projectMatch[1]
              .toLowerCase()

          const project =
            await getCloudProject(
              projectId,
              cloudAuthentication.user.id,
            )

          sendJson(
            response,
            200,
            {
              project,
            },
          )
        } catch (
          error
        ) {
          if (
            error instanceof
            CloudProjectNotFoundError
          ) {
            sendJson(
              response,
              404,
              {
                error:
                  'project-not-found',
              },
            )

            return
          }

          console.error(
            'Cloud project load request failed:',
            error,
          )

          sendJson(
            response,
            500,
            {
              error:
                'internal-error',
            },
          )
        }

        return
      }

      if (
        request.method ===
          'PUT' &&
        projectMatch
      ) {
        try {
          const projectId =
            projectMatch[1]
              .toLowerCase()

          const body =
            await readJsonBody(
              request,
            )

          if (
            !body ||
            typeof body !==
              'object' ||
            !Number.isInteger(
              body.baseRevision,
            ) ||
            body.baseRevision < 1 ||
            !body.project ||
            typeof body.project !==
              'object' ||
            body.project.format !==
              'LocalizationHubProject' ||
            body.project.version !==
              2
          ) {
            sendJson(
              response,
              400,
              {
                error:
                  'invalid-request',
              },
            )

            return
          }

          const project =
            await saveCloudProject(
              projectId,
              {
                userId:
                  cloudAuthentication.user.id,

                project:
                  body.project,

                baseRevision:
                  body.baseRevision,
              },
            )

          sendJson(
            response,
            200,
            {
              project,
            },
          )
        } catch (
          error
        ) {
          if (
            error instanceof
            CloudProjectNotFoundError
          ) {
            sendJson(
              response,
              404,
              {
                error:
                  'project-not-found',
              },
            )

            return
          }

          if (
            error instanceof
            CloudProjectPermissionError
          ) {
            sendJson(
              response,
              403,
              {
                error:
                  'project-read-only',

                message:
                  'This Cloud Project is read-only for your account.',
              },
            )

            return
          }

          if (
            error instanceof
            CloudProjectConflictError
          ) {
            sendJson(
              response,
              409,
              {
                error:
                  'revision-conflict',

                currentRevision:
                  error.currentRevision,
              },
            )

            return
          }

          console.error(
            'Cloud project save request failed:',
            error,
          )

          sendJson(
            response,
            400,
            {
              error:
                'invalid-request',
            },
          )
        }

        return
      }

      if (
        request.method ===
          'POST' &&
        request.url ===
          '/api/projects'
      ) {
        try {
          const body =
            await readJsonBody(
              request,
            )

          if (
            !body ||
            typeof body !==
              'object' ||
            typeof body.name !==
              'string' ||
            body.name.trim()
              .length === 0 ||
            !body.project ||
            typeof body.project !==
              'object' ||
            body.project.format !==
              'LocalizationHubProject' ||
            body.project.version !==
              2
          ) {
            sendJson(
              response,
              400,
              {
                error:
                  'invalid-request',
              },
            )

            return
          }

          const project =
            await createCloudProject({
              ownerUserId:
                cloudAuthentication.user.id,

              name:
                body.name.trim(),

              project:
                body.project,
            })

          sendJson(
            response,
            201,
            {
              project,
            },
          )
        } catch (
          error
        ) {
          console.error(
            'Cloud project create request failed:',
            error,
          )

          sendJson(
            response,
            400,
            {
              error:
                'invalid-request',
            },
          )
        }

        return
      }

      sendJson(
        response,
        404,
        {
          error:
            'not-found',
        },
      )
    },
  )

const server =
  new WebSocketServer({
    server:
      httpServer,

    maxPayload:
      MAX_PAYLOAD,
  })

httpServer.listen(
  PORT,
  HOST,
)

server.on(
  'connection',
  (socket) => {
    socket.isAlive =
      true

    socket.on(
      'pong',
      () => {
        socket.isAlive =
          true
      },
    )

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

        selectedEntryId:
          null,

        reconnectToken:
          null,

        reconnectTimer:
          null,

        disconnectedAt:
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
        scheduleClientDisconnect(
          socket,
        )

        console.log(
          '[client] disconnected; waiting for reconnect',
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

const heartbeatInterval =
  setInterval(
    () => {
      for (
        const socket of
          server.clients
      ) {
        if (
          socket.isAlive ===
          false
        ) {
          console.log(
            '[client] heartbeat timeout',
          )

          socket.terminate()

          continue
        }

        socket.isAlive =
          false

        socket.ping()
      }
    },
    HEARTBEAT_INTERVAL_MS,
  )

heartbeatInterval.unref?.()

server.on(
  'listening',
  () => {
    console.log('')
    console.log(
      'LocalizationHub Collaboration Relay',
    )

    console.log(
      `Listening on ${HOST}:${PORT}`,
    )

    console.log(
      `Health: http://127.0.0.1:${PORT}/health`,
    )

    console.log(
      'Waiting for WebSocket clients...',
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

server.on(
  'close',
  () => {
    clearInterval(
      heartbeatInterval,
    )
  },
)