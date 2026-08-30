import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { projectFromLocalDocument } from '../../website/src/localProjects'
import { parseLocalizationFile } from '../../packages/core/src/parsers'
import { openTools } from './helpers'

let server: ChildProcess
let base: string
const token = (role = 'owner') => role === 'owner' ? 'synthetic-lifecycle-token' : `synthetic-${role}-token`
const headers = (role = 'owner') => ({ Authorization: `Bearer ${token(role)}`, 'Content-Type': 'application/json' })
const parsed = parseLocalizationFile('{"hello":"Hello {name}"}', 'delete-test.json')
if (!parsed.ok) throw new Error(parsed.reason)
const project = projectFromLocalDocument(parsed.document, 'delete-test.json')
async function create(name: string) {
  const response = await fetch(`${base}/api/projects`, { method: 'POST', headers: headers(), body: JSON.stringify({ name, project }) })
  expect(response.status).toBe(201)
  return (await response.json()).project.id as string
}
async function member(id: string, role: 'editor' | 'viewer') {
  const response = await fetch(`${base}/api/projects/${id}/members`, { method: 'POST', headers: headers(), body: JSON.stringify({ username: `test_${role}`, role }) })
  expect(response.status).toBe(201)
}
async function visit(page: Page, role = 'owner', route = '/app/projects') {
  await page.addInitScript((token) => { localStorage.setItem('localizationhub.auth.token', token) }, token(role))
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

test('real DELETE HTTP authentication, ownership, privacy and repeat request', async () => {
  const id = await create('Authorization disposable')
  await member(id, 'editor'); await member(id, 'viewer')
  expect((await fetch(`${base}/api/projects/${id}`, { method: 'DELETE' })).status).toBe(401)
  for (const [role, status] of [['editor', 403], ['viewer', 403], ['outsider', 404]] as const) {
    const response = await fetch(`${base}/api/projects/${id}`, { method: 'DELETE', headers: headers(role) })
    expect(response.status).toBe(status)
  }
  expect((await fetch(`${base}/api/projects/${id}`, { headers: headers() })).status).toBe(200)
  const deleted = await fetch(`${base}/api/projects/${id}`, { method: 'DELETE', headers: headers() })
  expect(deleted.status).toBe(200); expect(await deleted.json()).toEqual({ deleted: true, projectId: id })
  for (const role of ['owner', 'editor', 'viewer', 'outsider']) expect((await fetch(`${base}/api/projects/${id}`, { headers: headers(role) })).status).toBe(404)
  expect((await fetch(`${base}/api/projects/${id}`, { method: 'DELETE', headers: headers() })).status).toBe(404)
})

for (const locale of ['en', 'ar'] as const) test(`owner card delete: exact name, cancel, focus, failure, retry and refresh in ${locale}`, async ({ page }) => {
  const name = `Disposable ${locale}`; const id = await create(name)
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message))
  await visit(page)
  await page.locator('.lh-language-switcher select').selectOption(locale)
  const card = page.locator('.project-card-shell').filter({ hasText: name })
  await card.locator('summary').click()
  await card.getByRole('button', { name: locale === 'en' ? 'Delete project' : 'حذف المشروع', exact: true }).click()
  const dialog = page.locator('.project-delete-dialog')
  const input = dialog.getByRole('textbox')
  const confirm = dialog.getByRole('button', { name: locale === 'en' ? 'Delete permanently' : 'حذف نهائياً', exact: true })
  await expect(input).toBeFocused(); await expect(confirm).toBeDisabled()
  await input.fill(`${name} `); await expect(confirm).toBeDisabled()
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
  await expect(card).toBeVisible()
  await card.locator('summary').click()
  await card.getByRole('button', { name: locale === 'en' ? 'Delete project' : 'حذف المشروع', exact: true }).click()
  await input.fill(name); await expect(confirm).toBeEnabled()
  expect((await new AxeBuilder({ page }).include('.project-delete-dialog').analyze()).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  let fail = true
  await page.route(`**/api/projects/${id}`, (route) => route.request().method() === 'DELETE' && fail ? route.fulfill({ status: 500, json: { error: 'internal-error' } }) : route.continue())
  await confirm.click(); await expect(dialog.getByRole('alert')).toBeVisible()
  expect((await fetch(`${base}/api/projects/${id}`, { headers: headers() })).status).toBe(200)
  await expect(card).toBeAttached()
  fail = false
  await confirm.click(); await expect(dialog).toHaveCount(0); await expect(card).toHaveCount(0)
  await page.reload(); await expect(card).toHaveCount(0)
  expect(errors).toEqual([])
})

for (const role of ['editor', 'viewer'] as const) test(`${role} cannot see card or overview deletion controls`, async ({ page }) => {
  const name = `Shared ${role}`; const id = await create(name); await member(id, role)
  await visit(page, role)
  const card = page.locator('.project-card-shell').filter({ hasText: name })
  await expect(card).toBeVisible(); await expect(card.locator('summary')).toHaveCount(0)
  await card.getByRole('button', { name: `Open ${name}`, exact: true }).click()
  await openTools(page)
  await page.getByRole('button', { name: /^(Project )?Overview$/i }).click()
  await expect(page.getByRole('heading', { name: 'Project Overview', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete project', exact: true })).toHaveCount(0)
})

test('owner overview deletion returns to refreshed Projects without unsaved prompt', async ({ page }) => {
  const id = await create('Overview disposable')
  await visit(page, 'owner', `/app/projects/${id}`)
  await expect(page.locator('.translation-editor')).toBeVisible()
  await page.locator('.translation-editor').fill('unsaved synthetic draft')
  await openTools(page)
  await page.getByRole('button', { name: /^(Project )?Overview$/i }).click()
  await page.getByRole('button', { name: 'Delete project', exact: true }).click()
  await page.locator('.project-delete-dialog input').fill('Overview disposable')
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(page).toHaveURL(`${base}/app/projects?deleted=1`)
  await expect(page.getByRole('button', { name: 'Open Overview disposable', exact: true })).toHaveCount(0)
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})
