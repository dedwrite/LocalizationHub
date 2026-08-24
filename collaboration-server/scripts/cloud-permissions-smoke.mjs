import WebSocket from 'ws'

const HTTP_URL =
  (
    process.env.LH_HTTP_URL ??
    'http://127.0.0.1:8787'
  ).replace(/\/+$/, '')

const WS_URL =
  (
    process.env.LH_WS_URL ??
    'ws://127.0.0.1:8787'
  ).replace(/\/+$/, '')

const PROTOCOL_VERSION =
  Number(
    process.env.LH_PROTOCOL_VERSION ??
      2,
  )

const OWNER_USERNAME =
  requireEnv(
    'LH_OWNER_USERNAME',
  )

const OWNER_PASSWORD =
  requireEnv(
    'LH_OWNER_PASSWORD',
  )

const EDITOR_USERNAME =
  requireEnv(
    'LH_EDITOR_USERNAME',
  )

const EDITOR_PASSWORD =
  requireEnv(
    'LH_EDITOR_PASSWORD',
  )

const PROJECT_ID =
  requireEnv(
    'LH_PROJECT_ID',
  )

const MESSAGE_TIMEOUT_MS =
  12_000

const sockets =
  new Set()

function requireEnv(
  name,
) {
  const value =
    process.env[name]
      ?.trim()

  if (!value) {
    console.error(
      `[CONFIG] Missing ${name}`,
    )

    process.exit(2)
  }

  return value
}

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(
      message,
    )
  }
}

function pass(
  message,
) {
  console.log(
    `[PASS] ${message}`,
  )
}

function step(
  message,
) {
  console.log(
    `\n[TEST] ${message}`,
  )
}

function sleep(
  milliseconds,
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  )
}

async function requestJson(
  path,
  {
    method = 'GET',
    token = null,
    body = undefined,
  } = {},
) {
  const headers = {
    Accept:
      'application/json',
  }

  if (token) {
    headers.Authorization =
      `Bearer ${token}`
  }

  if (
    body !==
    undefined
  ) {
    headers['Content-Type'] =
      'application/json'
  }

  const response =
    await fetch(
      `${HTTP_URL}${path}`,
      {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body,
              ),
      },
    )

  const text =
    await response.text()

  let data =
    null

  if (text) {
    try {
      data =
        JSON.parse(
          text,
        )
    } catch {
      data = {
        raw:
          text,
      }
    }
  }

  if (!response.ok) {
    const error =
      new Error(
        `${method} ${path} failed with HTTP ${response.status}: ${
          data?.message ??
          data?.error ??
          text ??
          'Unknown error'
        }`,
      )

    error.status =
      response.status

    error.data =
      data

    throw error
  }

  return data
}

function findToken(
  value,
  depth = 0,
) {
  if (
    !value ||
    depth > 8
  ) {
    return null
  }

  if (
    typeof value !==
    'object'
  ) {
    return null
  }

  for (
    const key of [
      'token',
      'sessionToken',
      'accessToken',
    ]
  ) {
    if (
      typeof value[key] ===
        'string' &&
      value[key].length > 0
    ) {
      return value[key]
    }
  }

  for (
    const child of
      Object.values(
        value,
      )
  ) {
    const found =
      findToken(
        child,
        depth + 1,
      )

    if (found) {
      return found
    }
  }

  return null
}

async function login(
  username,
  password,
) {
  const result =
    await requestJson(
      '/api/auth/login',
      {
        method:
          'POST',

        body: {
          username,
          password,
        },
      },
    )

  const token =
    findToken(
      result,
    )

  assert(
    token,
    `Login succeeded for ${username}, but no session token was found in the response.`,
  )

  return token
}

function findMembersArray(
  value,
  depth = 0,
) {
  if (
    value === null ||
    value === undefined ||
    depth > 8
  ) {
    return null
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    if (
      value.length === 0 ||
      value.some(
        (item) =>
          item &&
          typeof item ===
            'object' &&
          (
            'username' in item ||
            'userId' in item ||
            'role' in item
          ),
      )
    ) {
      return value
    }

    for (
      const child of value
    ) {
      const found =
        findMembersArray(
          child,
          depth + 1,
        )

      if (found) {
        return found
      }
    }

    return null
  }

  if (
    typeof value ===
    'object'
  ) {
    if (
      Array.isArray(
        value.members,
      )
    ) {
      return value.members
    }

    for (
      const child of
        Object.values(
          value,
        )
    ) {
      const found =
        findMembersArray(
          child,
          depth + 1,
        )

      if (found) {
        return found
      }
    }
  }

  return null
}

async function getMembers(
  ownerToken,
) {
  const result =
    await requestJson(
      `/api/projects/${PROJECT_ID}/members`,
      {
        token:
          ownerToken,
      },
    )

  const members =
    findMembersArray(
      result,
    )

  assert(
    members,
    'Could not locate the Cloud Project members array in the API response.',
  )

  return members
}

function findMember(
  members,
  username,
) {
  const normalized =
    username
      .trim()
      .toLowerCase()

  return (
    members.find(
      (member) =>
        typeof member?.username ===
          'string' &&
        member.username
          .trim()
          .toLowerCase() ===
          normalized,
    ) ??
    null
  )
}

async function ensureMemberRole(
  ownerToken,
  username,
  role,
) {
  let members =
    await getMembers(
      ownerToken,
    )

  let member =
    findMember(
      members,
      username,
    )

  if (!member) {
    await requestJson(
      `/api/projects/${PROJECT_ID}/members`,
      {
        method:
          'POST',

        token:
          ownerToken,

        body: {
          username,
          role,
        },
      },
    )

    members =
      await getMembers(
        ownerToken,
      )

    member =
      findMember(
        members,
        username,
      )

    assert(
      member,
      `Could not find ${username} after adding the member.`,
    )

    return member
  }

  if (
    member.role !==
    role
  ) {
    assert(
      member.userId,
      `Member ${username} has no userId.`,
    )

    await requestJson(
      `/api/projects/${PROJECT_ID}/members/${member.userId}`,
      {
        method:
          'PATCH',

        token:
          ownerToken,

        body: {
          role,
        },
      },
    )

    members =
      await getMembers(
        ownerToken,
      )

    member =
      findMember(
        members,
        username,
      )

    assert(
      member?.role ===
        role,
      `Could not change ${username} to ${role}.`,
    )
  }

  return member
}

async function removeMember(
  ownerToken,
  username,
) {
  const members =
    await getMembers(
      ownerToken,
    )

  const member =
    findMember(
      members,
      username,
    )

  if (!member) {
    return false
  }

  assert(
    member.userId,
    `Member ${username} has no userId.`,
  )

  await requestJson(
    `/api/projects/${PROJECT_ID}/members/${member.userId}`,
    {
      method:
        'DELETE',

      token:
        ownerToken,
    },
  )

  return true
}

async function issueTicket(
  token,
) {
  const result =
    await requestJson(
      '/api/collaboration/ticket',
      {
        method:
          'POST',

        token,
      },
    )

  assert(
    typeof result?.ticket ===
      'string' &&
      result.ticket.length > 0,
    'Collaboration ticket endpoint returned no ticket.',
  )

  return result.ticket
}

function buildWsUrl(
  ticket = null,
) {
  if (!ticket) {
    return WS_URL
  }

  const separator =
    WS_URL.includes('?')
      ? '&'
      : '?'

  return (
    `${WS_URL}${separator}` +
    `ticket=${encodeURIComponent(ticket)}`
  )
}

function openSocket(
  ticket = null,
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const socket =
        new WebSocket(
          buildWsUrl(
            ticket,
          ),
        )

      sockets.add(
        socket,
      )

      const timer =
        setTimeout(
          () => {
            cleanup()

            reject(
              new Error(
                'Timed out opening WebSocket.',
              ),
            )
          },
          MESSAGE_TIMEOUT_MS,
        )

      function cleanup() {
        clearTimeout(
          timer,
        )

        socket.off(
          'open',
          onOpen,
        )

        socket.off(
          'error',
          onError,
        )
      }

      function onOpen() {
        cleanup()

        resolve(
          socket,
        )
      }

      function onError(
        error,
      ) {
        cleanup()

        reject(
          error,
        )
      }

      socket.once(
        'open',
        onOpen,
      )

      socket.once(
        'error',
        onError,
      )
    },
  )
}

function waitForMessage(
  socket,
  predicate,
  label,
  {
    failOnServerError =
      true,
  } = {},
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const timer =
        setTimeout(
          () => {
            cleanup()

            reject(
              new Error(
                `Timed out waiting for ${label}.`,
              ),
            )
          },
          MESSAGE_TIMEOUT_MS,
        )

      function cleanup() {
        clearTimeout(
          timer,
        )

        socket.off(
          'message',
          onMessage,
        )

        socket.off(
          'close',
          onClose,
        )

        socket.off(
          'error',
          onError,
        )
      }

      function onMessage(
        raw,
      ) {
        let message

        try {
          message =
            JSON.parse(
              raw.toString(),
            )
        } catch {
          return
        }

        if (
          failOnServerError &&
          message?.type ===
            'error'
        ) {
          cleanup()

          reject(
            new Error(
              `Server error while waiting for ${label}: ${message.code}: ${message.message}`,
            ),
          )

          return
        }

        let matches =
          false

        try {
          matches =
            Boolean(
              predicate(
                message,
              ),
            )
        } catch (
          error
        ) {
          cleanup()

          reject(
            error,
          )

          return
        }

        if (!matches) {
          return
        }

        cleanup()

        resolve(
          message,
        )
      }

      function onClose() {
        cleanup()

        reject(
          new Error(
            `WebSocket closed while waiting for ${label}.`,
          ),
        )
      }

      function onError(
        error,
      ) {
        cleanup()

        reject(
          error,
        )
      }

      socket.on(
        'message',
        onMessage,
      )

      socket.once(
        'close',
        onClose,
      )

      socket.once(
        'error',
        onError,
      )
    },
  )
}

function send(
  socket,
  message,
) {
  assert(
    socket.readyState ===
      WebSocket.OPEN,
    'Cannot send through a closed WebSocket.',
  )

  socket.send(
    JSON.stringify(
      message,
    ),
  )
}

async function hostSession(
  socket,
  {
    displayName,
    cloudProjectId,
  },
) {
  const responsePromise =
    waitForMessage(
      socket,
      (message) =>
        message?.type ===
          'session-hosted',
      'session-hosted',
    )

  send(
    socket,
    {
      type:
        'host-session',

      protocolVersion:
        PROTOCOL_VERSION,

      displayName,

      ...(cloudProjectId
        ? {
            cloudProjectId,
          }
        : {}),
    },
  )

  return responsePromise
}

async function joinSession(
  socket,
  {
    sessionId,
    inviteToken,
    displayName,
  },
) {
  const responsePromise =
    waitForMessage(
      socket,
      (message) =>
        message?.type ===
          'session-joined',
      'session-joined',
    )

  send(
    socket,
    {
      type:
        'join-session',

      protocolVersion:
        PROTOCOL_VERSION,

      sessionId,

      inviteToken,

      displayName,
    },
  )

  return responsePromise
}

async function closeSocket(
  socket,
) {
  if (!socket) {
    return
  }

  sockets.delete(
    socket,
  )

  if (
    socket.readyState ===
      WebSocket.CLOSED
  ) {
    return
  }

  await new Promise(
    (resolve) => {
      const timer =
        setTimeout(
          resolve,
          1_000,
        )

      socket.once(
        'close',
        () => {
          clearTimeout(
            timer,
          )

          resolve()
        },
      )

      try {
        socket.close()
      } catch {
        clearTimeout(
          timer,
        )

        resolve()
      }
    },
  )
}

async function closeAllSockets() {
  const current =
    [
      ...sockets,
    ]

  await Promise.allSettled(
    current.map(
      closeSocket,
    ),
  )
}

async function main() {
  let ownerToken =
    null

  let editorToken =
    null

  let initialEditorRole =
    null

  let membershipTouched =
    false

  let editorSocket =
    null

  try {
    step(
      'Health endpoint',
    )

    const health =
      await fetch(
        `${HTTP_URL}/health`,
      )

    assert(
      health.ok,
      `Health endpoint returned HTTP ${health.status}.`,
    )

    pass(
      'Local relay is healthy',
    )


    step(
      'Authenticate Owner and Editor',
    )

    ownerToken =
      await login(
        OWNER_USERNAME,
        OWNER_PASSWORD,
      )

    editorToken =
      await login(
        EDITOR_USERNAME,
        EDITOR_PASSWORD,
      )

    pass(
      'Both accounts authenticated',
    )


    step(
      'Prepare Editor membership',
    )

    const beforeMembers =
      await getMembers(
        ownerToken,
      )

    const beforeEditor =
      findMember(
        beforeMembers,
        EDITOR_USERNAME,
      )

    initialEditorRole =
      beforeEditor?.role ??
      null

    await ensureMemberRole(
      ownerToken,
      EDITOR_USERNAME,
      'editor',
    )

    membershipTouched =
      true

    pass(
      'Editor membership is ready',
    )


    step(
      'One-time WebSocket ticket cannot be replayed',
    )

    const replayTicket =
      await issueTicket(
        ownerToken,
      )

    const ticketConsumer =
      await openSocket(
        replayTicket,
      )

    await closeSocket(
      ticketConsumer,
    )

    const replaySocket =
      await openSocket(
        replayTicket,
      )

    const replayResultPromise =
      waitForMessage(
        replaySocket,
        (message) =>
          message?.type ===
            'error' ||
          message?.type ===
            'session-hosted',
        'ticket replay result',
        {
          failOnServerError:
            false,
        },
      )

    send(
      replaySocket,
      {
        type:
          'host-session',

        protocolVersion:
          PROTOCOL_VERSION,

        displayName:
          'Replay Probe',

        cloudProjectId:
          PROJECT_ID,
      },
    )

    const replayResult =
      await replayResultPromise

    assert(
      replayResult.type ===
        'error' &&
      replayResult.code ===
        'authentication-required',
      'SECURITY FAILURE: a consumed WebSocket ticket authenticated a second connection.',
    )

    await closeSocket(
      replaySocket,
    )

    pass(
      'Consumed ticket was rejected',
    )


    step(
      'Owner hosts Cloud collaboration',
    )

    const ownerTicket =
      await issueTicket(
        ownerToken,
      )

    const ownerSocket =
      await openSocket(
        ownerTicket,
      )

    const hosted =
      await hostSession(
        ownerSocket,
        {
          displayName:
            'Smoke Owner',

          cloudProjectId:
            PROJECT_ID,
        },
      )

    assert(
      hosted.sessionId &&
      hosted.inviteToken &&
      hosted.participantId &&
      hosted.reconnectToken,
      'session-hosted response is missing reconnect/session fields.',
    )

    pass(
      'Owner hosted Cloud session',
    )


    step(
      'Editor joins Cloud collaboration',
    )

    const editorTicket =
      await issueTicket(
        editorToken,
      )

    editorSocket =
      await openSocket(
        editorTicket,
      )

    const joined =
      await joinSession(
        editorSocket,
        {
          sessionId:
            hosted.sessionId,

          inviteToken:
            hosted.inviteToken,

          displayName:
            'Smoke Editor',
        },
      )

    assert(
      joined.participantId &&
      joined.reconnectToken,
      'session-joined response is missing reconnect credentials.',
    )

    const editorReconnect = {
      sessionId:
        hosted.sessionId,

      participantId:
        joined.participantId,

      reconnectToken:
        joined.reconnectToken,
    }

    pass(
      'Editor joined Cloud session',
    )


    const entryId =
      `smoke-${Date.now()}`

    let revision =
      0


    step(
      'Editor mutation is accepted',
    )

    const firstUpdatePromise =
      waitForMessage(
        ownerSocket,
        (message) =>
          message?.type ===
            'translation-update' &&
          message.update?.entryId ===
            entryId,
        'first translation update',
      )

    send(
      editorSocket,
      {
        type:
          'translation-update',

        update: {
          entryId,

          translation:
            'smoke-editor-write-1',

          baseRevision:
            revision,
        },
      },
    )

    const firstUpdate =
      await firstUpdatePromise

    revision =
      firstUpdate.update
        .revision

    assert(
      Number.isInteger(
        revision,
      ) &&
      revision > 0,
      'Server returned an invalid translation revision.',
    )

    pass(
      `Editor write accepted at revision ${revision}`,
    )


    step(
      'Editor becomes Viewer live',
    )

    const viewerNoticePromise =
      waitForMessage(
        editorSocket,
        (message) =>
          message?.type ===
            'membership-changed' &&
          message.projectId ===
            PROJECT_ID &&
          message.role ===
            'viewer',
        'Viewer membership notification',
      )

    await ensureMemberRole(
      ownerToken,
      EDITOR_USERNAME,
      'viewer',
    )

    await viewerNoticePromise

    pass(
      'Editor received Viewer role live',
    )


    step(
      'Viewer mutation is rejected by server',
    )

    const viewerRejectedPromise =
      waitForMessage(
        editorSocket,
        (message) =>
          message?.type ===
            'error' &&
          message.code ===
            'permission-denied',
        'Viewer permission-denied',
        {
          failOnServerError:
            false,
        },
      )

    send(
      editorSocket,
      {
        type:
          'translation-update',

        update: {
          entryId,

          translation:
            'this-must-not-write',

          baseRevision:
            revision,
        },
      },
    )

    await viewerRejectedPromise

    pass(
      'Viewer write was blocked',
    )


    step(
      'Viewer becomes Editor live',
    )

    const editorNoticePromise =
      waitForMessage(
        editorSocket,
        (message) =>
          message?.type ===
            'membership-changed' &&
          message.projectId ===
            PROJECT_ID &&
          message.role ===
            'editor',
        'Editor membership notification',
      )

    await ensureMemberRole(
      ownerToken,
      EDITOR_USERNAME,
      'editor',
    )

    await editorNoticePromise

    pass(
      'Viewer received Editor role live',
    )


    step(
      'Restored Editor can write again',
    )

    const secondUpdatePromise =
      waitForMessage(
        ownerSocket,
        (message) =>
          message?.type ===
            'translation-update' &&
          message.update?.entryId ===
            entryId,
        'second translation update',
      )

    send(
      editorSocket,
      {
        type:
          'translation-update',

        update: {
          entryId,

          translation:
            'smoke-editor-write-2',

          baseRevision:
            revision,
        },
      },
    )

    const secondUpdate =
      await secondUpdatePromise

    revision =
      secondUpdate.update
        .revision

    pass(
      `Restored Editor write accepted at revision ${revision}`,
    )


    step(
      'Abrupt Editor disconnect',
    )

    const disconnectedSocket =
      editorSocket

    editorSocket =
      null

    await new Promise(
      (resolve) => {
        disconnectedSocket.once(
          'close',
          resolve,
        )

        disconnectedSocket.terminate()
      },
    )

    sockets.delete(
      disconnectedSocket,
    )

    await sleep(
      250,
    )

    pass(
      'Editor connection dropped',
    )


    step(
      'Different account cannot steal Editor resume',
    )

    const attackerTicket =
      await issueTicket(
        ownerToken,
      )

    const attackerSocket =
      await openSocket(
        attackerTicket,
      )

    const attackResultPromise =
      waitForMessage(
        attackerSocket,
        (message) =>
          message?.type ===
            'error' ||
          message?.type ===
            'session-resumed',
        'cross-account resume result',
        {
          failOnServerError:
            false,
        },
      )

    send(
      attackerSocket,
      {
        type:
          'resume-session',

        protocolVersion:
          PROTOCOL_VERSION,

        ...editorReconnect,
      },
    )

    const attackResult =
      await attackResultPromise

    assert(
      attackResult.type ===
        'error' &&
      attackResult.code ===
        'resume-invalid',
      'SECURITY FAILURE: another authenticated account resumed the Editor participant.',
    )

    await closeSocket(
      attackerSocket,
    )

    pass(
      'Cross-account resume was rejected',
    )


    step(
      'Real Editor resumes with fresh ticket',
    )

    const resumeTicket =
      await issueTicket(
        editorToken,
      )

    editorSocket =
      await openSocket(
        resumeTicket,
      )

    const resumeResultPromise =
      waitForMessage(
        editorSocket,
        (message) =>
          message?.type ===
            'session-resumed' ||
          message?.type ===
            'error',
        'legitimate resume result',
        {
          failOnServerError:
            false,
        },
      )

    send(
      editorSocket,
      {
        type:
          'resume-session',

        protocolVersion:
          PROTOCOL_VERSION,

        ...editorReconnect,
      },
    )

    const resumeResult =
      await resumeResultPromise

    assert(
      resumeResult.type ===
        'session-resumed',
      `Legitimate Editor resume failed: ${
        resumeResult.code ??
        'unknown error'
      }`,
    )

    pass(
      'Editor resumed its own participant',
    )


    step(
      'Resumed Editor can still mutate',
    )

    const resumedUpdatePromise =
      waitForMessage(
        ownerSocket,
        (message) =>
          message?.type ===
            'translation-update' &&
          message.update?.entryId ===
            entryId,
        'post-resume translation update',
      )

    send(
      editorSocket,
      {
        type:
          'translation-update',

        update: {
          entryId,

          translation:
            'smoke-after-resume',

          baseRevision:
            revision,
        },
      },
    )

    const resumedUpdate =
      await resumedUpdatePromise

    revision =
      resumedUpdate.update
        .revision

    pass(
      `Post-resume write accepted at revision ${revision}`,
    )


    step(
      'Membership removal is delivered live',
    )

    const revokePromise =
      waitForMessage(
        editorSocket,
        (message) =>
          message?.type ===
            'membership-revoked' &&
          message.projectId ===
            PROJECT_ID,
        'membership-revoked',
      )

    const removed =
      await removeMember(
        ownerToken,
        EDITOR_USERNAME,
      )

    assert(
      removed,
      'Editor membership disappeared before the removal test.',
    )

    await revokePromise

    pass(
      'Removed member received membership-revoked',
    )


    step(
      'Removed member cannot rejoin Cloud session',
    )

    const removedJoinPromise =
      waitForMessage(
        editorSocket,
        (message) =>
          message?.type ===
            'error' ||
          message?.type ===
            'session-joined',
        'removed-member join result',
        {
          failOnServerError:
            false,
        },
      )

    send(
      editorSocket,
      {
        type:
          'join-session',

        protocolVersion:
          PROTOCOL_VERSION,

        sessionId:
          hosted.sessionId,

        inviteToken:
          hosted.inviteToken,

        displayName:
          'Removed Editor',
      },
    )

    const removedJoin =
      await removedJoinPromise

    assert(
      removedJoin.type ===
        'error' &&
      removedJoin.code ===
        'membership-required',
      'SECURITY FAILURE: removed Cloud member rejoined the session.',
    )

    pass(
      'Removed member could not rejoin',
    )


    step(
      'Removed member cannot resume old participant',
    )

    const removedResumeTicket =
      await issueTicket(
        editorToken,
      )

    const removedResumeSocket =
      await openSocket(
        removedResumeTicket,
      )

    const removedResumePromise =
      waitForMessage(
        removedResumeSocket,
        (message) =>
          message?.type ===
            'error' ||
          message?.type ===
            'session-resumed',
        'removed-member resume result',
        {
          failOnServerError:
            false,
        },
      )

    send(
      removedResumeSocket,
      {
        type:
          'resume-session',

        protocolVersion:
          PROTOCOL_VERSION,

        ...editorReconnect,
      },
    )

    const removedResume =
      await removedResumePromise

    assert(
      removedResume.type ===
        'error',
      'SECURITY FAILURE: removed Cloud member resumed the old participant.',
    )

    await closeSocket(
      removedResumeSocket,
    )

    pass(
      `Removed member resume rejected (${removedResume.code})`,
    )


    step(
      'Anonymous local collaboration still works',
    )

    const localHost =
      await openSocket()

    const localHosted =
      await hostSession(
        localHost,
        {
          displayName:
            'Local Host',
        },
      )

    const localGuest =
      await openSocket()

    await joinSession(
      localGuest,
      {
        sessionId:
          localHosted.sessionId,

        inviteToken:
          localHosted.inviteToken,

        displayName:
          'Local Guest',
      },
    )

    const localEntryId =
      `local-smoke-${Date.now()}`

    const localUpdatePromise =
      waitForMessage(
        localHost,
        (message) =>
          message?.type ===
            'translation-update' &&
          message.update?.entryId ===
            localEntryId,
        'anonymous local translation update',
      )

    send(
      localGuest,
      {
        type:
          'translation-update',

        update: {
          entryId:
            localEntryId,

          translation:
            'anonymous-local-write',

          baseRevision:
            0,
        },
      },
    )

    await localUpdatePromise

    pass(
      'Anonymous local host/join/mutation works',
    )


    console.log(
      '\n========================================',
    )

    console.log(
      '[PASS] ALL CLOUD/COLLABORATION SMOKE TESTS PASSED',
    )

    console.log(
      '========================================',
    )
  } finally {
    await closeAllSockets()

    if (
      ownerToken &&
      membershipTouched
    ) {
      try {
        if (
          initialEditorRole ===
          null
        ) {
          await removeMember(
            ownerToken,
            EDITOR_USERNAME,
          )

          console.log(
            '[CLEANUP] Restored Editor to non-member state.',
          )
        } else {
          await ensureMemberRole(
            ownerToken,
            EDITOR_USERNAME,
            initialEditorRole,
          )

          console.log(
            `[CLEANUP] Restored Editor role to ${initialEditorRole}.`,
          )
        }
      } catch (
        error
      ) {
        console.error(
          '[CLEANUP WARNING]',
          error instanceof Error
            ? error.message
            : error,
        )
      }
    }
  }
}

main().catch(
  (error) => {
    console.error(
      '\n[FAIL]',
      error instanceof Error
        ? error.message
        : error,
    )

    process.exitCode =
      1
  },
)
