import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { projectFromLocalDocument } from '../../website/src/localProjects'
import { parseLocalizationFile } from '../../packages/core/src/parsers'

let server: ChildProcess
let base: string
const token = (role = 'owner') => role === 'owner' ? 'synthetic-lifecycle-token' : `synthetic-${role}-token`
const address = (role = 'owner') => `${role}@example.invalid`
const headers = (role = 'owner') => ({ Authorization: `Bearer ${token(role)}`, 'Content-Type': 'application/json' })
const bearer = (value: string) => ({ Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' })
const parsed = parseLocalizationFile('{"hello":"Hello {name}"}', 'account-test.json')
if (!parsed.ok) throw new Error(parsed.reason)
const project = projectFromLocalDocument(parsed.document, 'account-test.json')

async function create(name: string) {
  const response = await fetch(`${base}/api/projects`, { method: 'POST', headers: headers(), body: JSON.stringify({ name, project }) })
  expect(response.status).toBe(201)
  return (await response.json()).project.id as string
}
async function register(username: string, email: string) {
  const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password: 'synthetic-password' }) })
  expect(response.status).toBe(201)
  return (await response.json()) as { user: { id: string; email: string }; token: string }
}
async function visit(page: Page, value: string, route = '/app/projects') {
  await page.addInitScript((session) => { localStorage.setItem('localizationhub.auth.token', session) }, value)
  await page.route('**/api/radio/**', (route) => route.fulfill({ json: { tracks: [] } }))
  await page.goto(`${base}${route}`)
}

test.beforeAll(async () => {
  const reservation = createServer()
  await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve))
  const port = (reservation.address() as { port: number }).port
  await new Promise<void>((resolve) => reservation.close(() => resolve()))
  base = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, ['collaboration-server/tests/helpers/project-lifecycle-server.mjs'], { env: { ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  await expect.poll(async () => { try { return (await fetch(`${base}/health`)).status } catch { return 0 } }).toBe(200)
})
test.afterAll(async () => { if (server?.exitCode === null) { const exited = new Promise<void>((resolve) => server.once('exit', () => resolve())); server.kill(); await exited } })

test('real HTTP refusals never touch the account or its projects', async () => {
  const id = await create('Refusal disposable')
  expect((await fetch(`${base}/api/account`, { method: 'DELETE' })).status).toBe(401)
  const wrong = await fetch(`${base}/api/account`, { method: 'DELETE', headers: headers(), body: JSON.stringify({ confirmEmail: 'someone.else@example.invalid' }) })
  expect(wrong.status).toBe(400); expect((await wrong.json()).error).toBe('account-confirmation-required')
  const owned = await fetch(`${base}/api/account`, { method: 'DELETE', headers: headers(), body: JSON.stringify({ confirmEmail: address() }) })
  expect(owned.status).toBe(409); expect((await owned.json()).error).toBe('user-has-projects')
  expect((await fetch(`${base}/api/auth/me`, { headers: headers() })).status).toBe(200)
  expect((await fetch(`${base}/api/projects/${id}`, { headers: headers() })).status).toBe(200)
})

test('a fresh account deletes itself and only its own membership', async () => {
  const id = await create('Shared with a fresh account')
  const fresh = await register('fresh_member', 'fresh.member@example.invalid')
  const added = await fetch(`${base}/api/projects/${id}/members`, { method: 'POST', headers: headers(), body: JSON.stringify({ username: 'fresh_member', role: 'editor' }) })
  expect(added.status).toBe(201)
  const deleted = await fetch(`${base}/api/account`, { method: 'DELETE', headers: bearer(fresh.token), body: JSON.stringify({ confirmEmail: fresh.user.email, deleteOwnedProjects: false }) })
  expect(deleted.status).toBe(200); expect(await deleted.json()).toEqual({ deleted: true, projects: 0 })
  expect((await fetch(`${base}/api/auth/me`, { headers: bearer(fresh.token) })).status).toBe(401)
  const members = await fetch(`${base}/api/projects/${id}/members`, { headers: headers() })
  expect(members.status).toBe(200)
  expect((await members.json()).members.map((member: { username: string }) => member.username)).toEqual(['test_owner'])
})

test('the dashboard deletes the account it is signed in as and leaves nothing behind', async ({ page }) => {
  const id = await create('Dashboard disposable')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await visit(page, token())
  const zone = page.locator('.account-danger-zone')
  await expect(zone).toBeVisible(); await expect(zone).toContainText(address())
  const open = zone.getByRole('button', { name: 'Delete my account', exact: true })
  await open.click()
  const dialog = page.locator('.account-delete-dialog')
  const email = dialog.getByRole('textbox')
  const include = dialog.getByRole('checkbox')
  const confirm = dialog.getByRole('button', { name: 'Delete account permanently', exact: true })
  await expect(dialog).toBeVisible(); await expect(email).toBeFocused(); await expect(confirm).toBeDisabled()
  await email.fill('someone.else@example.invalid'); await include.check(); await expect(confirm).toBeDisabled()
  await email.fill(`${address()} `); await expect(confirm).toBeEnabled()
  await include.uncheck(); await expect(confirm).toBeDisabled()
  await include.check(); await expect(confirm).toBeEnabled()
  expect((await new AxeBuilder({ page }).include('.account-delete-dialog').analyze()).violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')).toEqual([])
  await page.locator('.lh-language-switcher select').selectOption('ar')
  await expect(dialog.getByRole('heading')).toHaveText('حذف حسابك نهائيًا؟')
  await expect(dialog.getByRole('button', { name: 'احذف الحساب نهائيًا', exact: true })).toBeEnabled()
  await page.locator('.lh-language-switcher select').selectOption('en')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect((await fetch(`${base}/api/auth/me`, { headers: headers() })).status).toBe(200)

  await open.click()
  let fail = true
  await page.route('**/api/account', (route) => fail ? route.fulfill({ status: 500, json: { error: 'internal-error' } }) : route.continue())
  await dialog.getByRole('checkbox').check(); await email.fill(address()); await confirm.click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect((await fetch(`${base}/api/auth/me`, { headers: headers() })).status).toBe(200)
  await expect(page.locator('.project-card-shell').filter({ hasText: 'Dashboard disposable' })).toBeVisible()

  fail = false
  await confirm.click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(`${base}/`)
  expect(await page.evaluate(() => localStorage.getItem('localizationhub.auth.token'))).toBeNull()
  expect((await fetch(`${base}/api/auth/me`, { headers: headers() })).status).toBe(401)
  expect((await fetch(`${base}/api/projects/${id}`, { headers: headers('editor') })).status).toBe(404)
  expect(errors).toEqual([])
})
