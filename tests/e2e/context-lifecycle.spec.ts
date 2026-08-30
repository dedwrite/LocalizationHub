import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { parseLocalizationFile } from '../../packages/core/src/parsers'
import { decodeCloudProject } from '../../website/src/appApi'
import { decodeLocalizationProject } from '../../packages/core/src/projectModel'
import { openEditor } from './helpers'

const text = readFileSync('tests/fixtures/caloy-mark.json', 'utf8')
const expected = { speaker: 'Caloy', speakerGender: 'male', listener: 'Mark', listenerGender: 'male', scene: '4/Assembly.1d.inkb' }
const user = { id: '22222222-2222-4222-8222-222222222222', username: 'tester', email: 'test@example.com', emailVerified: true, createdAt: '2026-08-30T00:00:00Z' }
let server: ChildProcess
let baseURL: string
const persisted: Array<{ id: string; project: any }> = []

async function prepareWeb(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem('localizationhub.auth.token', 'synthetic-lifecycle-token')
    localStorage.setItem('localizationhub.auth.user', JSON.stringify(user))
  }, user)
  await page.route('**/api/radio/**', (route) => route.fulfill({ json: { tracks: [] } }))
}

async function fillImport(page: Page, name: string) {
  await page.getByRole('button', { name: '+ New project', exact: true }).click()
  await page.getByLabel('Project name', { exact: true }).fill(name)
  await page.locator('input[type="file"]').setInputFiles({ name: 'caloy-mark.json', mimeType: 'application/json', buffer: Buffer.from(text) })
}

test.beforeAll(async () => {
  const reservation = createServer()
  await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve))
  const port = (reservation.address() as { port: number }).port
  await new Promise<void>((resolve) => reservation.close(() => resolve()))
  baseURL = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, ['collaboration-server/tests/helpers/project-lifecycle-server.mjs'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  server.on('message', (message: any) => { if (message.type === 'persisted') persisted.push(message) })
  await expect.poll(async () => { try { return (await fetch(`${baseURL}/health`)).status } catch { return 0 } }).toBe(200)
})
test.afterAll(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise<void>((resolve) => server.once('exit', () => resolve()))
    server.kill()
    await exited
  }
})

for (const locale of ['en', 'ar'] as const) {
test(`real import -> HTTP persistence -> GET -> Workspace -> MT in ${locale}`, async ({ page }) => {
  const parsed = parseLocalizationFile(text, 'caloy-mark.json')
  expect(parsed.ok).toBe(true)
  if (parsed.ok) expect(parsed.document.entries[0].dialogueContext).toMatchObject(expected)
  await prepareWeb(page)
  let instruction = ''
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    instruction = route.request().postDataJSON().system_instruction.parts[0].text
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'ترجمة اختبارية.' }] } }] } })
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${baseURL}/app/projects`)
  const name = `Context lifecycle ${locale}`
  await fillImport(page, name)
  const request = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/api/projects')
  const created = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/projects')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  const body = (await request).postDataJSON()
  expect(body.project.entries[0].dialogueContext).toMatchObject(expected)
  expect(body.project.entries[0].dialogueContext).toEqual(parsed.ok ? parsed.document.entries[0].dialogueContext : null)
  const response = await created
  expect(response.status()).toBe(201)
  const snapshot = (await response.json()).project
  const id = snapshot.id
  expect(snapshot.project.entries[0].dialogueContext).toEqual(body.project.entries[0].dialogueContext)
  await expect.poll(() => persisted.find((row) => row.id === id)?.project.entries[0].dialogueContext).toEqual(body.project.entries[0].dialogueContext)
  const loaded = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === `/api/projects/${id}`)
  await page.getByRole('button', { name: `Open ${name}`, exact: true }).click()
  const fetched = (await (await loaded).json()).project
  expect(fetched.project.entries[0].dialogueContext).toEqual(body.project.entries[0].dialogueContext)
  expect(decodeCloudProject(fetched).project.entries[0].dialogueContext).toMatchObject(expected)
  const decoded = decodeLocalizationProject(JSON.stringify(fetched.project))
  expect(decoded.ok).toBe(true)
  if (decoded.ok) expect(decoded.project.entries[0].dialogueContext).toEqual(body.project.entries[0].dialogueContext)
  await openEditor(page)
  await page.locator('.lh-language-switcher select').selectOption(locale)
  const visible = locale === 'en' ? 'Speaker: Caloy (male) · → Listener: Mark (male) · Scene: 4/Assembly.1d.inkb' : 'المتحدث: Caloy (ذكر) · → المستمع: Mark (ذكر) · المشهد: 4/Assembly.1d.inkb'
  await expect(page.locator('.dialogue-context-strip')).toHaveText(visible)
  // Let the real metadata reads settle before reloading. WebKit reports
  // interrupted same-origin fetches as access-control page errors on teardown.
  await page.waitForLoadState('networkidle')
  await page.reload()
  if (locale === 'ar') await page.locator('.lh-language-switcher select').selectOption('en')
  await openEditor(page)
  await page.locator('.lh-language-switcher select').selectOption(locale)
  await expect(page.locator('.dialogue-context-strip')).toHaveText(visible)
  await page.locator('.mt-toggle').click()
  await page.locator('input[name="mt-provider-key"]').fill('synthetic-test-key')
  await page.locator('.mt-actions button').first().click()
  await expect(page.locator('.mt-result')).toBeVisible()
  expect(instruction).toContain('Speaker: Caloy (male) | Listener: Mark (male) | Scene: 4/Assembly.1d.inkb')
  await page.locator('.lh-language-switcher select').selectOption('en')
  const saved = page.waitForResponse((response) => response.request().method() === 'PUT' && new URL(response.url()).pathname === `/api/projects/${id}`)
  const translation = '[shake rate=32 level=8]ترجمة اختبارية.[/shake]'
  await page.getByLabel('Translation', { exact: true }).fill(translation)
  await page.keyboard.press('Control+s')
  const savedResponse = await saved
  expect(savedResponse.status()).toBe(200)
  expect((await savedResponse.json()).project.project.entries[0].dialogueContext).toEqual(body.project.entries[0].dialogueContext)
  await expect.poll(() => persisted.filter((row) => row.id === id).at(-1)?.project.entries[0].translation).toBe(translation)
  await page.waitForLoadState('networkidle')
  await page.reload()
  await openEditor(page)
  await expect(page.getByLabel('Translation', { exact: true })).toHaveValue(translation)
  await page.locator('.lh-language-switcher select').selectOption(locale)
  await expect(page.locator('.dialogue-context-strip')).toHaveText(visible)
  expect(errors).toEqual([])
})

test(`open Web tab across deployment blocks stale import without a POST, then reload recovers in ${locale}`, async ({ page }) => {
  await prepareWeb(page)
  const manifest = JSON.parse(readFileSync('website/dist/web-build.json', 'utf8'))
  const entry = manifest.entries[0] as string
  const nextEntry = 'assets/index-deployment-test.js'
  let deployed = false
  // Only static deployment assets are substituted. POST/GET project requests
  // still reach the real server + test SQL adapter; no project DTO injection.
  await page.route('**/web-build.json', (route) => deployed
    ? route.fulfill({ json: { entries: [nextEntry] }, headers: { 'Cache-Control': 'no-store' } })
    : route.continue())
  await page.route(`**/${nextEntry}`, (route) => route.fulfill({ path: `website/dist/${entry}`, contentType: 'text/javascript' }))
  await page.route(`${baseURL}/app/projects`, (route) => deployed && route.request().isNavigationRequest()
    ? route.fulfill({ body: readFileSync('website/dist/index.html', 'utf8').replace(entry, nextEntry), contentType: 'text/html' })
    : route.continue())
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let posts = 0
  page.on('request', (r) => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/projects') posts++ })
  await page.goto(`${baseURL}/app/projects`)
  const name = `Deployment import ${locale}`
  await fillImport(page, name)
  await page.locator('.lh-language-switcher select').selectOption(locale)
  deployed = true
  await page.locator('button[type="submit"]').click()
  await expect(page.getByRole('alert')).toContainText(locale === 'en' ? 'reload this page' : 'أعد تحميل الصفحة')
  expect(posts).toBe(0)
  await expect(page.locator('.dialog input').first()).toHaveValue(name)
  await expect(page.locator('.dialog')).toBeVisible() // No automatic reload or lost draft.
  await page.reload()
  await page.locator('.lh-language-switcher select').selectOption('en')
  await fillImport(page, name)
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/projects')
  await page.locator('button[type="submit"]').click()
  const response = await created
  expect(response.status()).toBe(201)
  expect((await response.json()).project.project.entries[0].dialogueContext).toMatchObject(expected)
  expect(posts).toBe(1)
  expect(errors).toEqual([])
})

test(`unavailable or malformed build identity stays inline and permits retry in ${locale}`, async ({ page }) => {
  await prepareWeb(page)
  let mode: '500' | 'malformed' | 'current' = '500'
  await page.route('**/web-build.json', (route) => mode === 'current' ? route.continue() : route.fulfill({ status: mode === '500' ? 500 : 200, json: mode === '500' ? { error: 'unexpected' } : { entries: [null] } }))
  let posts = 0
  page.on('request', (r) => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/projects') posts++ })
  await page.goto(`${baseURL}/app/projects`)
  const name = `Build retry ${locale}`
  await fillImport(page, name)
  await page.locator('.lh-language-switcher select').selectOption(locale)
  for (const failure of ['500', 'malformed'] as const) {
    mode = failure
    const checked = page.waitForResponse('**/web-build.json')
    await page.locator('button[type="submit"]').click()
    await checked
    await expect(page.getByRole('alert')).toContainText(locale === 'en' ? 'Could not verify' : 'تعذر التحقق')
    expect(posts).toBe(0)
    await expect(page.locator('.dialog input').first()).toHaveValue(name)
  }
  mode = 'current'
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/projects')
  await page.locator('button[type="submit"]').click()
  expect((await created).status()).toBe(201)
  expect(posts).toBe(1)
  await expect(page.locator('.dialog')).toHaveCount(0)
})
}
