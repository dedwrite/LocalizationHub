import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { projectFromLocalDocument } from '../../website/src/localProjects'
import { parseLocalizationFile } from '../../packages/core/src/parsers'

const parsed = parseLocalizationFile('{"hello":"Hello {name}"}', 'desktop-synthetic.json')
if (!parsed.ok) throw new Error(parsed.reason)
const project = projectFromLocalDocument(parsed.document, 'desktop-synthetic.json')
const id = '77777777-7777-4777-8777-777777777777'
const name = 'Desktop disposable'

// Actual production Desktop React bundle, with only HTTP and native host
// boundaries isolated. Never launches an installer or contacts production.
for (const role of ['owner', 'editor', 'viewer'] as const) test(`Desktop ${role} deletion flow preserves state until success`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const user = { id: 'synthetic-desktop-user', username: 'desktop_test', email: 'desktop@example.invalid', emailVerified: true, createdAt: new Date().toISOString() }
  await page.addInitScript((user) => {
    localStorage.setItem('localizationhub.auth-session', JSON.stringify({ user, token: 'synthetic-desktop-token', expiresAt: '2099-01-01T00:00:00Z' }))
    // The native window chrome is not under test; no filesystem command is
    // implemented or permitted by this synthetic host.
    ;(window as any).__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }, transformCallback: () => 1, unregisterCallback: () => {}, invoke: async (command: string) => {
      if (command.includes('window') || command.includes('event')) return false
      throw new Error(`Unexpected native operation: ${command}`)
    } }
    ;(window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} }
  }, user)
  const snapshot = { id, name, role, revision: 1, updatedAt: new Date().toISOString(), sourceFileName: project.sourceFileName, project }
  let deleted = false; let fail = true; let deletes = 0
  const unexpected: string[] = []
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  await page.route('**/*', async (route) => {
    const request = route.request(); const url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: { user } })
      if (url.pathname === '/api/projects') return route.fulfill({ json: { projects: deleted ? [] : [snapshot] } })
      if (url.pathname === `/api/projects/${id}`) {
        if (request.method() === 'DELETE') { deletes++; if (fail) return route.fulfill({ status: 500, json: { error: 'internal-error' } }); deleted = true; return route.fulfill({ json: { deleted: true, projectId: id } }) }
        return route.fulfill({ json: { project: snapshot } })
      }
      // LH Radio ships in the desktop chrome and loads its public catalog on
      // mount; the catalog is empty in this fixture.
      if (url.pathname === '/api/radio/tracks') return route.fulfill({ json: { tracks: [] } })
      if (url.pathname.endsWith('/members')) return route.fulfill({ json: { members: [] } })
      if (url.pathname.endsWith('/assignments')) return route.fulfill({ json: { assignments: [] } })
      if (url.pathname.includes('/comments')) return route.fulfill({ json: { comments: [] } })
      if (url.pathname.includes('/activity')) return route.fulfill({ json: { activity: [] } })
      unexpected.push(url.pathname); return route.fulfill({ status: 404, json: { error: 'not-found' } })
    }
    const root = resolve('frontend/dist'); const file = resolve(join(root, url.pathname === '/__desktop-test' ? 'index.html' : url.pathname.slice(1)))
    if (file.startsWith(root + '\\') && existsSync(file)) return route.fulfill({ path: file, contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : undefined })
    // Bundled fonts/images outside the fixture may be absent; do not network.
    return route.fulfill({ status: 404, body: '' })
  })
  await page.goto('/__desktop-test')
  const card = page.locator('.cloud-project-card').filter({ hasText: name })
  await expect.poll(async () => ({ text: (await page.locator('body').innerText()).includes(name), errors: runtimeErrors, unexpected })).toEqual({ text: true, errors: [], unexpected: [] })
  await card.getByRole('button', { name: 'Open', exact: true }).click()
  await page.screenshot({path:testInfo.outputPath('desktop-editor.png'),fullPage:true})
  if (role === 'owner') await page.locator('.cm-content[contenteditable="true"]').fill('unsaved Desktop draft')
  await page.getByRole('button', { name: 'Project Overview', exact: true }).click()
  const destroy = page.getByRole('button', { name: 'Delete project', exact: true })
  if (role !== 'owner') { await expect(destroy).toHaveCount(0); expect(deletes).toBe(0); return }
  await destroy.click()
  const dialog = page.locator('.project-delete-dialog')
  await expect(dialog.getByRole('button', { name: 'Delete permanently', exact: true })).toBeDisabled()
  await dialog.getByRole('textbox').fill(name)
  await dialog.getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(page.locator('.cm-content[contenteditable="true"]')).toContainText('unsaved Desktop draft')
  expect(await page.evaluate(() => localStorage.getItem('localizationhub.last-session'))).toContain(id)
  fail = false
  await dialog.getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('My Cloud Projects', { exact: true })).toBeVisible()
  await expect(card).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('localizationhub.last-session'))).toBeNull()
  expect(deletes).toBe(2); expect(unexpected).toEqual([])
})
