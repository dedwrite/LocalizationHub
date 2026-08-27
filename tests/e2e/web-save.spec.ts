import { expect, test, type Page } from '@playwright/test'
import { openTools } from './helpers'

type State = {
  project: any
  revision: number
  role: 'owner' | 'viewer'
  saves: Array<{ body: any; project: any }>
}

function baseProject() {
  return {
    format: 'LocalizationHubProject',
    version: 3,
    sourceFileName: 'game.json',
    selectedEntryId: null,
    tokenProfile: 'generic',
    document: { parser: 'json', format: 'flat-json-object', sourceText: '{}', language: { sourceDirection: 'ltr', translationDirection: 'ltr' } },
    entries: [
      { id: 'e0', key: 'menu.start', source: 'Start', translation: '' },
      { id: 'e1', key: 'menu.quit', source: 'Quit', translation: 'Quitter' },
    ],
    workflow: { entries: {} },
    metadata: { tags: [{ id: 'ui', label: 'UI' }], entryTags: {}, assignments: {}, comments: [], glossary: [], translationMemory: [{ source: 'Start', translation: 'Commencer' }] },
  }
}

let state: State

function resetState() {
  state = { project: baseProject(), revision: 3, role: 'owner', saves: [] }
}

function projectResponse() {
  return { id: 'proj-1', name: 'Game Project', role: state.role, revision: state.revision, updatedAt: new Date().toISOString(), project: state.project }
}

async function mockCloudApi(page: Page, role: 'owner' | 'viewer' = 'owner') {
  state.role = role
  await page.route('**/api/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'user-1', username: 'tester', email: 't@example.com', emailVerified: true, createdAt: new Date().toISOString() } }) }))
  await page.route('**/api/projects/proj-1', async (route) => {
    const method = route.request().method()
    if (method === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}')
      state.saves.push({ body, project: body.project })
      state.project = body.project
      state.revision += 1
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: projectResponse() }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: projectResponse() }) })
  })
  await page.route('**/api/projects/proj-1/members', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: [{ id: 'user-1', username: 'tester', role }, { id: 'user-2', username: 'samira', role: 'editor' }] }) }))
  await page.route('**/api/projects/proj-1/assignments', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [] }) }))
  await page.route('**/api/projects/proj-1/comments-summary', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) }))
  await page.route('**/api/projects/proj-1/entries/*/comments', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [] }) }))
  await page.route('**/api/projects/proj-1/activity**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activity: [] }) }))
}

async function signIn(page: Page) {
  await page.goto('/app/login')
  await page.evaluate(() => {
    localStorage.setItem('localizationhub.auth.token', 'test-token')
    localStorage.setItem('localizationhub.auth.user', JSON.stringify({ id: 'user-1', username: 'tester', email: 't@example.com', emailVerified: true, createdAt: new Date().toISOString() }))
  })
}

test.describe('cloud save regression', () => {
  test.beforeEach(async ({ page }) => {
    resetState()
    await mockCloudApi(page)
    await signIn(page)
  })

  test('manual save sends a real project object and persists on reload', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await page.getByLabel('Translation').fill('Commencer')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    expect(state.saves.length).toBeGreaterThanOrEqual(1)
    const last = state.saves.at(-1)!
    expect(typeof last.project).toBe('object')
    expect(last.project.format).toBe('LocalizationHubProject')
    expect(last.project.version).toBe(3)
    expect(last.project.entries[0].translation).toBe('Commencer')

    await page.reload()
    await expect(page.getByLabel('Translation')).toHaveValue('Commencer')
  })

  test('autosave sends a valid object and persists on reload', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await page.getByLabel('Translation').fill('Autosaved text')
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 6000 })

    const last = state.saves.at(-1)!
    expect(typeof last.project).toBe('object')
    expect(last.project.entries[0].translation).toBe('Autosaved text')

    await page.reload()
    await expect(page.getByLabel('Translation')).toHaveValue('Autosaved text')
  })

  test('functional draft updater (toggle tag) never serializes a function', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await openTools(page)
    await page.getByRole('tab', { name: 'Tags', exact: true }).click()
    await page.getByRole('button', { name: 'UI' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 6000 })

    const last = state.saves.at(-1)!
    expect(typeof last.project).toBe('object')
    expect(last.project.metadata.entryTags['e0']).toContain('ui')

    await page.reload()
    await openTools(page)
    await page.getByRole('tab', { name: 'Tags', exact: true }).click()
    await expect(page.getByRole('button', { name: 'UI' })).toHaveClass(/active/)
  })

  test('functional draft updater (create tag) persists', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await openTools(page)
    await page.getByRole('tab', { name: 'Tags', exact: true }).click()
    await page.getByLabel('New tag label').fill('Ship')
    await page.getByRole('button', { name: 'Add tag' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 6000 })

    const last = state.saves.at(-1)!
    expect(typeof last.project).toBe('object')
    expect(last.project.metadata.tags.some((tag: any) => tag.label === 'Ship')).toBe(true)
  })

  test('functional draft updater (apply Translation Memory) persists', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await openTools(page)
    await page.getByRole('tab', { name: 'Memory', exact: true }).click()
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 6000 })

    const last = state.saves.at(-1)!
    expect(typeof last.project).toBe('object')
    expect(last.project.entries[0].translation).toBe('Commencer')

    await page.reload()
    await expect(page.getByLabel('Translation')).toHaveValue('Commencer')
  })

  test('rapid edits before debounce produce a single coherent save of the final value', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await page.getByLabel('Translation').fill('First draft')
    await page.getByLabel('Translation').fill('Second draft')
    await page.getByLabel('Translation').fill('Final value')
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 6000 })

    expect(state.saves.length).toBeGreaterThanOrEqual(1)
    const last = state.saves.at(-1)!
    expect(last.project.entries[0].translation).toBe('Final value')

    await page.reload()
    await expect(page.getByLabel('Translation')).toHaveValue('Final value')
  })

  test('viewer performs no write requests', async ({ page }) => {
    await mockCloudApi(page, 'viewer')
    await signIn(page)
    await page.goto('/app/projects/proj-1')
    await expect(page.getByLabel('Translation')).not.toBeEditable()
    await expect(page.getByText('Read only')).toBeVisible()
    expect(state.saves.length).toBe(0)
  })
})
