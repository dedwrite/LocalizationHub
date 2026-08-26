import { expect, test } from '@playwright/test'

test('two browser contexts use the real protocol-v2 collaboration server', async ({ browser }) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  const owner = await first.newPage()
  const guest = await second.newPage()
  await owner.goto('/app/local')
  await guest.goto('/app/local')
  const hosted = await owner.evaluate(() => new Promise<any>(resolve => { const socket = new WebSocket(`ws://${location.host}`); (window as any).collabSocket = socket; socket.onopen = () => socket.send(JSON.stringify({ type: 'host-session', protocolVersion: 2, displayName: 'Browser A' })); socket.onmessage = event => { const message = JSON.parse(event.data); if (message.type === 'session-hosted') resolve(message) } }))
  expect(hosted.sessionId).toBeTruthy()
  const joined = await guest.evaluate((credentials: any) => new Promise<any>(resolve => { const socket = new WebSocket(`ws://${location.host}`); (window as any).collabSocket = socket; socket.onopen = () => socket.send(JSON.stringify({ type: 'join-session', protocolVersion: 2, sessionId: credentials.sessionId, inviteToken: credentials.inviteToken, displayName: 'Browser B' })); socket.onmessage = event => { const message = JSON.parse(event.data); if (message.type === 'session-joined') resolve(message) } }), hosted)
  expect(joined.sessionId).toBe(hosted.sessionId)
  const updateWait = guest.evaluate(() => new Promise<any>(resolve => { (window as any).collabResolve = resolve; (window as any).collabSocket.addEventListener('message', (event: MessageEvent) => { const message = JSON.parse(event.data); if (message.type === 'translation-update') (window as any).collabResolve(message) }) }))
  await owner.evaluate(() => (window as any).collabSocket.send(JSON.stringify({ type: 'translation-update', update: { entryId: 'entry-1', translation: 'sync', baseRevision: 0 } })))
  const update = await updateWait
  expect(update.type).toBe('translation-update')
  expect(update.update.revision).toBe(1)
  await first.close()
  await second.close()
})
