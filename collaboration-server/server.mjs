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
  canEditCloudProject,
  createCloudProject,
  getCloudProject,
  getCloudProjectRoleForUser,
  listCloudProjectMembers,
  listCloudProjects,
  removeCloudProjectMember,
  saveCloudProject,
  updateCloudProjectMember,
} from './cloud-projects.mjs'
import {
  assignCloudEntry,
  createCloudComment,
  listCloudActivity,
  listCloudAssignments,
  listCloudComments,
  resolveCloudComment,
  restoreCloudActivity,
} from './cloud-workflow.mjs'
import { isValidCloudProjectV3 } from './cloud-project-validation.mjs'
import {
  resolvePublicWebsiteDirectory,
  ensurePublicWebsiteDirectory,
  servePublicWebsite,
} from './public-website.mjs'
import {
  getDatabasePool,
} from './database.mjs'

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
  sendAdminAccessCodeEmail,
  sendVerificationEmail,
} from './email-delivery.mjs'
import {
  AdminSecurityError,
  authenticateAdminSession,
  beginTotpEnrollment,
  createAdminSession,
  getSuperAdmin,
  requestAdminEmailCode,
  revokeAdminSession,
  verifyAdminEmailCode,
  verifyAdminTotp,
  changeProjectMemberRole,
  deleteProject,
  deleteUser,
  getProject,
  getRecentActivity,
  getStorageBreakdown,
  getUser,
  getPlatformMetrics,
  listAuditLog,
  listProjects,
  listUserSessions,
  listUsers,
  reconfirmAdminTotp,
  removeUserProjectMembership,
  requireRecentTotp,
  revokeAllUserSessions,
  revokeSession,
  suspendUser,
  transferProjectOwnership,
  unverifyUserEmail,
  unsuspendUser,
  verifyUserEmail,
  writeAdminAudit,
} from './admin.mjs'
import {
  EMAIL_VERIFICATION_PAGE,
} from './email-verification-page.mjs'

import {
  randomUUID,
  randomInt,
  randomBytes,
} from 'node:crypto'

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

const SERVE_PUBLIC_WEBSITE =
  process.env.SERVE_PUBLIC_WEBSITE ===
  '1'

const PUBLIC_WEBSITE_DIST =
  resolvePublicWebsiteDirectory()

if (SERVE_PUBLIC_WEBSITE) {
  try {
    ensurePublicWebsiteDirectory(PUBLIC_WEBSITE_DIST)
  } catch (error) {
    console.error('[website] Public website serving could not start:', error.message)
    throw error
  }
}

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
  30_000

const HEARTBEAT_INTERVAL_MS =
  30_000

const SESSION_ID_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const COLLABORATION_TICKET_TTL_MS =
  60_000

const sessions =
  new Map()

const clients =
  new Map()

/*
 * Short-lived, one-time WebSocket tickets.
 *
 * The real session token is never sent to
 * the WebSocket. A client exchanges it over
 * HTTPS for a ticket that expires in 60s and
 * can only be consumed once.
 */
const collaborationTickets =
  new Map()

const pendingAdminEmailVerifications =
  new Map()

function createCollaborationTicket(
  userId,
  emailVerified,
) {
  const ticket =
    randomBytes(32)
      .toString(
        'base64url',
      )

  collaborationTickets.set(
    ticket,
    {
      userId,

      emailVerified:
        Boolean(
          emailVerified,
        ),

      expiresAt:
        Date.now() +
        COLLABORATION_TICKET_TTL_MS,
    },
  )

  return ticket
}

function consumeCollaborationTicket(
  ticket,
) {
  if (
    typeof ticket !==
      'string' ||
    ticket.length === 0
  ) {
    return null
  }

  const record =
    collaborationTickets.get(
      ticket,
    )

  if (!record) {
    return null
  }

  /*
   * One-time use: remove before any
   * early return so a ticket can never
   * be replayed.
   */
  collaborationTickets.delete(
    ticket,
  )

  if (
    record.expiresAt <=
    Date.now()
  ) {
    return null
  }

  return record
}

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

function normalizeCloudProjectId(
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
      .toLowerCase()

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      normalized,
    )
  ) {
    return null
  }

  return normalized
}

/*
 * WebSocket connections cannot carry
 * custom headers from the browser, so the
 * short-lived one-time ticket travels as a
 * query parameter.
 *
 * The real session token is never sent here.
 */
function getWebSocketTicket(
  url,
) {
  if (
    typeof url !==
      'string'
  ) {
    return null
  }

  const queryIndex =
    url.indexOf('?')

  if (
    queryIndex ===
      -1
  ) {
    return null
  }

  const query =
    url.slice(
      queryIndex +
        1,
    )

  const ticket = query
    .split('&')
    .map(
      (part) =>
        part.split('='),
    )
    .find(
      ([
        key,
      ]) =>
        key ===
        'ticket',
    )

  if (
    !ticket ||
    ticket.length < 2
  ) {
    return null
  }

  try {
    return decodeURIComponent(
      ticket[1],
    )
  } catch {
    return null
  }
}

/*
 * Authorizes a live collaboration mutation.
 *
 * When a session is bound to a Cloud Project,
 * only members with editor or owner access may
 * push translation updates or snapshots.
 *
 * The check is re-evaluated on every mutation
 * so live role changes take effect immediately.
 */
async function requireCloudEditAccess(
  socket,
  session,
) {
  const state =
    getClientState(
      socket,
    )

  if (
    !state ||
    !session.cloudProjectId
  ) {
    return {
      allowed:
        true,
    }
  }

  if (!state.userId) {
    return {
      allowed:
        false,

      code:
        'authentication-required',

      message:
        'Sign in to edit this Cloud Project.',
    }
  }

  const role =
    await getCloudProjectRoleForUser(
      session.cloudProjectId,
      state.userId,
    )

  if (
    !canEditCloudProject(
      role,
    )
  ) {
    return {
      allowed:
        false,

      code:
        'permission-denied',

      message:
        role ===
        null
          ? 'Your access to this Cloud Project was revoked.'
          : 'Viewer access is read-only for this Cloud Project.',
    }
  }

  return {
    allowed:
      true,

    role,
  }
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

/*
 * Notifies every connected client of a Cloud
 * Project that a membership changed.
 *
 * - `newRole === null` means the member was
 *   removed; the affected client is told to
 *   leave the Cloud workspace immediately.
 * - Otherwise the affected client receives
 *   its updated role so the UI can lock or
 *   unlock editing without reopening.
 */
function notifyCloudMembershipChanged(
  projectId,
  affectedUserId,
  newRole,
) {
  for (
    const session of
      sessions.values()
  ) {
    if (
      session.cloudProjectId !==
      projectId
    ) {
      continue
    }

    for (
      const socket of
        session.sockets
    ) {
      const state =
        getClientState(
          socket,
        )

      if (
        !state ||
        state.userId !==
          affectedUserId
      ) {
        continue
      }

      if (
        newRole ===
        null
      ) {
        send(
          socket,
          {
            type:
              'membership-revoked',

            projectId,
          },
        )

        clearClientSession(
          socket,
        )

        session.sockets.delete(
          socket,
        )
      } else {
        state.cloudRole =
          newRole

        send(
          socket,
          {
            type:
              'membership-changed',

            projectId,

            role:
              newRole,
          },
        )
      }
    }

    /*
     * If the removed member was the host,
     * end the session cleanly for the
     * remaining guests.
     */
    if (
      session.hostSocket &&
      !session.sockets.has(
        session.hostSocket,
      )
    ) {
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
          'The host left the collaboration session.',
        )
      }

      session.sockets.clear()

      sessions.delete(
        session.sessionId,
      )

      continue
    }

    if (
      session.sockets.size ===
      0
    ) {
      sessions.delete(
        session.sessionId,
      )
    }
  }
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

  state.cloudProjectId =
    null

  state.cloudRole =
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

async function handleResumeSession(
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

  /*
   * A Cloud reconnect must belong to the
   * same authenticated account that owned
   * the previous participant connection.
   *
   * The current Cloud role is fetched again
   * from PostgreSQL so role changes and
   * removals apply during reconnect.
   */
  let resumedCloudState =
    null

  if (session.cloudProjectId) {
    const currentState =
      getClientState(
        socket,
      )

    if (!currentState?.userId) {
      sendError(
        socket,
        'authentication-required',
        'Sign in to resume this Cloud Project collaboration session.',
      )

      return
    }

    if (
      !previousState.userId ||
      currentState.userId !==
        previousState.userId
    ) {
      sendError(
        socket,
        'resume-invalid',
        'The collaboration participant could not be resumed.',
      )

      return
    }

    const cloudRole =
      await getCloudProjectRoleForUser(
        session.cloudProjectId,
        currentState.userId,
      )

    if (!cloudRole) {
      sendError(
        socket,
        'membership-required',
        'You are no longer a member of this Cloud Project.',
      )

      return
    }

    resumedCloudState = {
      userId:
        currentState.userId,
      emailVerified:
        currentState.emailVerified,
      cloudProjectId:
        session.cloudProjectId,
      cloudRole,
    }
  }

  const replacingConnectedSocket =
    previousSocket.readyState ===
    WebSocket.OPEN

  /*
   * Local anonymous reconnects cannot
   * replace an actively connected client.
   *
   * Cloud reconnects may replace a stale
   * OPEN socket only after the account,
   * reconnect token, and current membership
   * were authenticated above.
   */
  if (
    replacingConnectedSocket &&
    !resumedCloudState
  ) {
    sendError(
      socket,
      'resume-invalid',
      'This collaboration participant is already connected.',
    )

    return
  }

  if (resumedCloudState) {
    previousState.userId =
      resumedCloudState.userId

    previousState.emailVerified =
      resumedCloudState.emailVerified

    previousState.cloudProjectId =
      resumedCloudState.cloudProjectId

    previousState.cloudRole =
      resumedCloudState.cloudRole
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

  if (replacingConnectedSocket) {
    /*
     * The old socket has already been
     * detached from clients/session state,
     * so its close handler cannot evict the
     * newly resumed participant.
     */
    previousSocket.terminate()
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

async function handleHostSession(
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

  const cloudProjectId =
    message.cloudProjectId
      ? normalizeCloudProjectId(
          message.cloudProjectId,
        )
      : null

  if (
    message.cloudProjectId &&
    !cloudProjectId
  ) {
    sendError(
      socket,
      'invalid-message',
      'The Cloud Project ID is invalid.',
    )

    return
  }

  let cloudRole =
    null

  if (cloudProjectId) {
    const stateBefore =
      getClientState(
        socket,
      )

    if (!stateBefore?.userId) {
      sendError(
        socket,
        'authentication-required',
        'Sign in to host a Cloud Project collaboration session.',
      )

      return
    }

    cloudRole =
      await getCloudProjectRoleForUser(
        cloudProjectId,
        stateBefore.userId,
      )

    if (
      !canEditCloudProject(
        cloudRole,
      )
    ) {
      sendError(
        socket,
        'permission-denied',
        'Only editors and the owner can host a Cloud Project collaboration session.',
      )

      return
    }
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

  state.cloudProjectId =
    cloudProjectId

  state.cloudRole =
    cloudRole

  const session = {
    sessionId,

    inviteToken,

    cloudProjectId,

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

async function handleJoinSession(
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

  let cloudRole =
    null

  if (session.cloudProjectId) {
    const joinerState =
      getClientState(
        socket,
      )

    if (!joinerState?.userId) {
      sendError(
        socket,
        'authentication-required',
        'Sign in to join this Cloud Project collaboration session.',
      )

      return
    }

    cloudRole =
      await getCloudProjectRoleForUser(
        session.cloudProjectId,
        joinerState.userId,
      )

    if (!cloudRole) {
      sendError(
        socket,
        'membership-required',
        'You are not a member of this Cloud Project.',
      )

      return
    }
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

  state.cloudProjectId =
    session.cloudProjectId ??
    null

  state.cloudRole =
    cloudRole

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

async function handleProjectSnapshot(
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

  const access =
    await requireCloudEditAccess(
      socket,
      session,
    )

  if (!access.allowed) {
    sendError(
      socket,
      access.code,
      access.message,
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

async function handleTranslationUpdate(
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

  const access =
    await requireCloudEditAccess(
      socket,
      session,
    )

  if (!access.allowed) {
    sendError(
      socket,
      access.code,
      access.message,
    )

    return
  }

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


async function handleMessage(
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
      await handleHostSession(
        socket,
        message,
      )

      break

    case 'join-session':
      await handleJoinSession(
        socket,
        message,
      )

      break
    case 'resume-session':
      await handleResumeSession(
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
      await handleProjectSnapshot(
        socket,
        message,
      )

      break

    case 'translation-update':
      await handleTranslationUpdate(
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

async function getAdminRequest(request) {
  const authentication = await getAuthenticatedRequest(request)
  if (!authentication) return null
  const adminToken = request.headers['x-admin-session']
  if (!adminToken) return null
  const adminSession = await authenticateAdminSession(adminToken, authentication.user.id)
  return adminSession ? { ...authentication, adminToken, adminSession } : null
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

      if (request.url?.startsWith('/api/admin')) {
        const authentication = await getAuthenticatedRequest(request)
        if (!authentication) {
          sendJson(response, 401, { error: 'unauthorized', message: 'Authentication is required.' })
          return
        }
        const superAdmin = await getSuperAdmin(authentication.user.id)
        if (!superAdmin) {
          sendJson(response, 403, { error: 'admin-forbidden', message: 'Super Admin access is required.' })
          return
        }
        try {
          if (request.method === 'POST' && request.url === '/api/admin/auth/email/request') {
            const challenge = await requestAdminEmailCode(superAdmin.id)
            await sendAdminAccessCodeEmail({ email: challenge.user.email, code: challenge.code })
            sendJson(response, 202, { ok: true })
            return
          }
          if (request.method === 'POST' && request.url === '/api/admin/auth/email/verify') {
            const body = await readJsonBody(request)
            await verifyAdminEmailCode(superAdmin.id, body?.code)
            pendingAdminEmailVerifications.set(superAdmin.id, Date.now() + 5 * 60 * 1000)
            sendJson(response, 200, { ok: true })
            return
          }
          const emailVerifiedUntil = pendingAdminEmailVerifications.get(superAdmin.id) ?? 0
          if (emailVerifiedUntil <= Date.now()) {
            sendJson(response, 403, { error: 'admin-email-required', message: 'A fresh Admin email code is required.' })
            return
          }
          if (request.method === 'POST' && request.url === '/api/admin/auth/totp/enroll') {
            const enrollment = await beginTotpEnrollment(superAdmin.id, superAdmin.username)
            sendJson(response, 200, enrollment)
            return
          }
          if (request.method === 'POST' && request.url === '/api/admin/auth/totp/confirm') {
            const body = await readJsonBody(request)
            await verifyAdminTotp(superAdmin.id, body?.code)
            const adminToken = await createAdminSession(superAdmin.id)
            pendingAdminEmailVerifications.delete(superAdmin.id)
            sendJson(response, 200, { ok: true, adminToken })
            return
          }
          const adminRequest = await getAdminRequest(request)
          if (!adminRequest) {
            sendJson(response, 403, { error: 'admin-session-required', message: 'A valid Admin session is required.' })
            return
          }
          if (request.method === 'POST' && request.url === '/api/admin/auth/totp/reconfirm') {
            const body = await readJsonBody(request)
            await reconfirmAdminTotp(adminRequest.adminToken, adminRequest.user.id, body?.code)
            sendJson(response, 200, { ok: true })
            return
          }
          if (request.method === 'POST' && request.url === '/api/admin/auth/logout') {
            await revokeAdminSession(adminRequest.adminToken)
            sendJson(response, 200, { ok: true })
            return
          }
          if (request.method === 'GET' && request.url === '/api/admin') {
            const metrics = await getPlatformMetrics()
            const recentActivity = await getRecentActivity(10)
            sendJson(response, 200, { user: { id: superAdmin.id, username: superAdmin.username }, metrics, recentActivity })
            return
          }
          const urlPatterns = { users: /^\/api\/admin\/users(?:\/([a-f0-9-]+))?(?:\?.*)?$/, projects: /^\/api\/admin\/projects(?:\/([a-f0-9-]+))?(?:\?.*)?$/, storage: /^\/api\/admin\/storage(?:\?.*)?$/, sessions: /^\/api\/admin\/sessions(?:\?.*)?$/, audit: /^\/api\/admin\/audit(?:\?.*)?$/ }
          const usersMatch = request.url.match(urlPatterns.users)
          const projectsMatch = request.url.match(urlPatterns.projects)
          const storageMatch = request.url.match(urlPatterns.storage)
          const sessionsMatch = request.url.match(urlPatterns.sessions)
          const auditMatch = request.url.match(urlPatterns.audit)
          if (request.method === 'GET' && usersMatch) {
            const userId = usersMatch[1]
            if (userId) {
              const user = await getUser(userId)
              if (!user) { sendJson(response, 404, { error: 'user-not-found' }); return }
              sendJson(response, 200, user)
            } else {
              const url = new URL(`http://localhost${request.url}`)
              const search = url.searchParams.get('search') || ''
              const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
              const offset = parseInt(url.searchParams.get('offset') || '0')
              const result = await listUsers({ search, limit, offset })
              sendJson(response, 200, result)
            }
            return
          }
          if (request.method === 'POST' && usersMatch) {
            await requireRecentTotp(adminRequest.adminToken, adminRequest.user.id)
            const url = new URL(`http://localhost${request.url}`)
            const action = url.searchParams.get('action')
            const userId = url.searchParams.get('userId')
            if (!userId) { sendJson(response, 400, { error: 'user-id-required' }); return }
            if (action === 'suspend') { await suspendUser(userId, superAdmin.id); await writeAdminAudit({ adminUserId: superAdmin.id, action: 'admin.user.suspend', targetType: 'user', targetId: userId, success: true }); sendJson(response, 200, { ok: true }); return }
            if (action === 'unsuspend') { await unsuspendUser(userId, superAdmin.id); await writeAdminAudit({ adminUserId: superAdmin.id, action: 'admin.user.unsuspend', targetType: 'user', targetId: userId, success: true }); sendJson(response, 200, { ok: true }); return }
            if (action === 'verify-email') { await verifyUserEmail(userId, superAdmin.id); sendJson(response, 200, { ok: true }); return }
            if (action === 'unverify-email') { await unverifyUserEmail(userId, superAdmin.id); sendJson(response, 200, { ok: true }); return }
            if (action === 'revoke-sessions') { await revokeAllUserSessions(userId, superAdmin.id); sendJson(response, 200, { ok: true }); return }
            if (action === 'delete') { const body = await readJsonBody(request); await deleteUser(userId, body?.deleteOwnedProjects || false, superAdmin.id); sendJson(response, 200, { ok: true }); return }
            sendJson(response, 400, { error: 'invalid-action' })
            return
          }
          if (request.method === 'GET' && projectsMatch) {
            const projectId = projectsMatch[1]
            if (projectId) {
              const project = await getProject(projectId)
              if (!project) { sendJson(response, 404, { error: 'project-not-found' }); return }
              sendJson(response, 200, project)
            } else {
              const url = new URL(`http://localhost${request.url}`)
              const search = url.searchParams.get('search') || ''
              const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
              const offset = parseInt(url.searchParams.get('offset') || '0')
              const result = await listProjects({ search, limit, offset })
              sendJson(response, 200, result)
            }
            return
          }
          if (request.method === 'POST' && projectsMatch) {
            await requireRecentTotp(adminRequest.adminToken, adminRequest.user.id)
            const url = new URL(`http://localhost${request.url}`)
            const action = url.searchParams.get('action')
            const projectId = url.searchParams.get('projectId')
            if (!projectId) { sendJson(response, 400, { error: 'project-id-required' }); return }
            if (action === 'remove-member') { const body = await readJsonBody(request); await removeUserProjectMembership(projectId, body?.userId, superAdmin.id); sendJson(response, 200, { ok: true }); return }
            if (action === 'change-member-role') { const body = await readJsonBody(request); await changeProjectMemberRole(projectId, body?.userId, body?.role, superAdmin.id); sendJson(response, 200, { ok: true }); return }
            if (action === 'transfer-ownership') { const body = await readJsonBody(request); await transferProjectOwnership(projectId, body?.newOwnerId, superAdmin.id); sendJson(response, 200, { ok: true }); return }
            if (action === 'delete') { await deleteProject(projectId, superAdmin.id); sendJson(response, 200, { ok: true }); return }
            sendJson(response, 400, { error: 'invalid-action' })
            return
          }
          if (request.method === 'GET' && storageMatch) {
            const url = new URL(`http://localhost${request.url}`)
            const userId = url.searchParams.get('userId')
            if (userId) {
              const storage = await getStorageBreakdown(userId)
              sendJson(response, 200, storage)
            } else {
              const metrics = await getPlatformMetrics()
              sendJson(response, 200, { platform: metrics })
            }
            return
          }
          if (request.method === 'GET' && sessionsMatch) {
            const url = new URL(`http://localhost${request.url}`)
            const userId = url.searchParams.get('userId')
            if (!userId) { sendJson(response, 400, { error: 'user-id-required' }); return }
            const sessions = await listUserSessions(userId)
            sendJson(response, 200, { sessions })
            return
          }
          if (request.method === 'POST' && sessionsMatch) {
            await requireRecentTotp(adminRequest.adminToken, adminRequest.user.id)
            const url = new URL(`http://localhost${request.url}`)
            const action = url.searchParams.get('action')
            const tokenHash = url.searchParams.get('tokenHash')
            if (!tokenHash) { sendJson(response, 400, { error: 'token-hash-required' }); return }
            if (action === 'revoke') { await revokeSession(tokenHash); await writeAdminAudit({ adminUserId: superAdmin.id, action: 'admin.session.revoke', targetType: 'session', targetId: tokenHash, success: true }); sendJson(response, 200, { ok: true }); return }
            sendJson(response, 400, { error: 'invalid-action' })
            return
          }
          if (request.method === 'GET' && auditMatch) {
            const url = new URL(`http://localhost${request.url}`)
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
            const offset = parseInt(url.searchParams.get('offset') || '0')
            const action = url.searchParams.get('action')
            const result = await listAuditLog({ limit, offset, action })
            sendJson(response, 200, result)
            return
          }
          sendJson(response, 404, { error: 'not-found' })
        } catch (error) {
          if (error instanceof AdminSecurityError) {
            sendJson(response, 403, { error: error.code, message: error.message })
            return
          }
          console.error('Admin request failed:', error)
          sendJson(response, 500, { error: 'internal-error' })
        }
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

      /*
       * Issues a short-lived, one-time WebSocket
       * ticket in exchange for a valid bearer
       * token.
       *
       * The real session token never enters the
       * WebSocket URL; only this ephemeral ticket
       * does. It is consumed once on connection.
       */
      if (
        request.method ===
          'POST' &&
        request.url ===
          '/api/collaboration/ticket'
      ) {
        const authentication =
          await getAuthenticatedRequest(
            request,
          )

        if (!authentication) {
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

        const ticket =
          createCollaborationTicket(
            authentication.user.id,
            authentication.user.emailVerified,
          )

        sendJson(
          response,
          200,
          {
            ticket,
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

      const uuidPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
      const assignmentMatch = request.url?.match(new RegExp(`^/api/projects/(${uuidPattern})/assignments(?:/([^/]+))?$`))
      const commentsMatch = request.url?.match(new RegExp(`^/api/projects/(${uuidPattern})/entries/([^/]+)/comments$`))
      const commentMatch = request.url?.match(new RegExp(`^/api/projects/(${uuidPattern})/comments/(${uuidPattern})$`))
      const activityMatch = request.url?.match(new RegExp(`^/api/projects/(${uuidPattern})/activity(?:\\?.*)?$`))
      const restoreMatch = request.url?.match(new RegExp(`^/api/projects/(${uuidPattern})/activity/([0-9]+)/restore$`))

      if (assignmentMatch || commentsMatch || commentMatch || activityMatch || restoreMatch) {
        try {
          const projectId = (assignmentMatch?.[1] ?? commentsMatch?.[1] ?? commentMatch?.[1] ?? activityMatch?.[1] ?? restoreMatch?.[1]).toLowerCase()
          const actorUserId = cloudAuthentication.user.id
          if (assignmentMatch) {
            if (request.method === 'GET' && !assignmentMatch[2]) sendJson(response, 200, await listCloudAssignments(projectId, actorUserId))
            else if (request.method === 'PUT' && assignmentMatch[2]) { const body = await readJsonBody(request); if (!body || (body.assigneeUserId !== null && typeof body.assigneeUserId !== 'string')) { sendJson(response, 400, { error: 'invalid-request' }); return } sendJson(response, 200, await assignCloudEntry(projectId, decodeURIComponent(assignmentMatch[2]), body.assigneeUserId, actorUserId)) }
            else { sendJson(response, 404, { error: 'not-found' }) }
          } else if (commentsMatch) {
            const entryId = decodeURIComponent(commentsMatch[2])
            if (request.method === 'GET') sendJson(response, 200, { comments: await listCloudComments(projectId, entryId, actorUserId) })
            else if (request.method === 'POST') { const body = await readJsonBody(request); if (!body || typeof body.body !== 'string' || !body.body.trim()) { sendJson(response, 400, { error: 'invalid-request' }); return } sendJson(response, 201, { comment: await createCloudComment(projectId, entryId, body.body, actorUserId) }) }
            else sendJson(response, 404, { error: 'not-found' })
          } else if (commentMatch) {
            if (request.method !== 'PATCH') { sendJson(response, 404, { error: 'not-found' }); return }
            const body = await readJsonBody(request); if (!body || typeof body.resolved !== 'boolean') { sendJson(response, 400, { error: 'invalid-request' }); return }
            sendJson(response, 200, { comment: await resolveCloudComment(projectId, commentMatch[2], body.resolved, actorUserId) })
          } else if (restoreMatch) {
            if (request.method !== 'POST') { sendJson(response, 404, { error: 'not-found' }); return }
            const body = await readJsonBody(request)
            if (!body || !Number.isInteger(body.baseRevision) || body.baseRevision < 1) { sendJson(response, 400, { error: 'invalid-request' }); return }
            sendJson(response, 200, { restore: await restoreCloudActivity(projectId, restoreMatch[2], body.baseRevision, actorUserId) })
          } else {
            const url = new URL(request.url, 'http://localhost')
            sendJson(response, 200, { activity: await listCloudActivity(projectId, url.searchParams.get('entryId'), actorUserId) })
          }
        } catch (error) {
          if (error instanceof CloudProjectNotFoundError) { sendJson(response, 404, { error: error.code === 'entry-not-found' ? 'entry-not-found' : 'project-not-found' }); return }
          if (error instanceof CloudProjectPermissionError) { sendJson(response, 403, { error: 'project-read-only' }); return }
          if (error.message === 'invalid-assignee') { sendJson(response, 400, { error: 'invalid-assignee' }); return }
          if (error.message === 'invalid-body') { sendJson(response, 400, { error: 'invalid-request' }); return }
          if (error.message === 'revision-conflict') { sendJson(response, 409, { error: 'revision-conflict' }); return }
          if (error.message === 'entry-not-found') { sendJson(response, 404, { error: 'entry-not-found' }); return }
          if (error.message === 'invalid-activity') { sendJson(response, 400, { error: 'invalid-activity' }); return }
          console.error('Cloud workflow request failed:', error); sendJson(response, 500, { error: 'internal-error' })
        }
        return
      }

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

          notifyCloudMembershipChanged(
            projectId,
            memberUserId,
            member.role,
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

          notifyCloudMembershipChanged(
            projectId,
            memberUserId,
            null,
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
            !isValidCloudProjectV3(body.project)
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
            !isValidCloudProjectV3(body.project)
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

      if (SERVE_PUBLIC_WEBSITE) {
        const served = await servePublicWebsite(
          request,
          response,
          PUBLIC_WEBSITE_DIST,
        )

        if (served) {
          return
        }
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
  (socket, request) => {
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

        userId:
          null,

        emailVerified:
          false,

        cloudProjectId:
          null,

        cloudRole:
          null,
      },
    )

    const connectionTicket =
      getWebSocketTicket(
        request?.url,
      )

    if (connectionTicket) {
      const ticketRecord =
        consumeCollaborationTicket(
          connectionTicket,
        )

      if (ticketRecord) {
        const state =
          getClientState(
            socket,
          )

        if (state) {
          state.userId =
            ticketRecord.userId

          state.emailVerified =
            ticketRecord.emailVerified
        }
      }
    }

    console.log(
      '[client] connected',
    )

    socket.on(
      'message',
      (rawData) => {
        handleMessage(
          socket,
          rawData,
        ).catch(
          (error) => {
            console.error(
              '[server] message handling failed',
              error,
            )

            sendError(
              socket,
              'server-error',
              'The collaboration server could not process the request.',
            )
          },
        )
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