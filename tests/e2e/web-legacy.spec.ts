import { expect, test, type Page } from '@playwright/test'
import { openEditor, openEntries } from './helpers'

// Realistic V2 (pre-workflow) project payload as the server would return it.
function v2Project() {
  return {
    format: 'LocalizationHubProject',
    version: 2,
    sourceFileName: 'legacy.json',
    selectedEntryId: 'legacy:0:menu.start',
    tokenProfile: 'generic',
    document: { parser: 'json', format: 'flat-json-object', sourceText: '{}', language: { sourceDirection: 'ltr', translationDirection: 'ltr' } },
    entries: [
      { id: 'legacy:0:menu.start', key: 'menu.start', source: 'Start', translation: '', keyPath: ['menu.start'], sourcePath: ['menu.start'] },
      { id: 'legacy:1:menu.quit', key: 'menu.quit', source: 'Quit', translation: 'Quitter', keyPath: ['menu.quit'], sourcePath: ['menu.quit'] },
    ],
  }
}

let revision = 5
let putCount = 0
let storedProject: any

async function mockLegacyApi(page: Page, role: 'owner' | 'viewer' = 'owner') {
  await page.route('**/api/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'user-1', username: 'tester', email: 't@example.com', emailVerified: true, createdAt: new Date().toISOString() } }) }))
  await page.route('**/api/projects/proj-1', async (route) => {
    const method = route.request().method()
    if (method === 'PUT') {
      putCount += 1
      const body = JSON.parse(route.request().postData() || '{}')
      storedProject = body.project
      revision += 1
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: { id: 'proj-1', name: 'Legacy Game', role, revision, updatedAt: new Date().toISOString(), project: storedProject } }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: { id: 'proj-1', name: 'Legacy Game', role, revision, updatedAt: new Date().toISOString(), project: storedProject ?? v2Project() } }) })
  })
  await page.route('**/api/projects/proj-1/members', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: [{ id: 'user-1', username: 'tester', role }] }) }))
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

test.describe('legacy cloud project migration', () => {
  test.beforeEach(() => {
    revision = 5
    putCount = 0
    storedProject = undefined
  })

  test('V2 project opens, migrates in memory, and saves a V3 payload', async ({ page }) => {
    await mockLegacyApi(page)
    await signIn(page)
    await page.goto('/app/projects/proj-1')

    // Both legacy entries remain present.
    await openEntries(page)
    await expect(page.locator('.entry-key').filter({ hasText: 'menu.start' })).toBeVisible()
    await expect(page.locator('.entry-key').filter({ hasText: 'menu.quit' })).toBeVisible()
    await expect(page.getByText(/Legacy Project V2 loaded/)).toBeVisible()

    // Edit + manual save.
    await openEditor(page)
    await page.getByLabel('Translation').fill('Commencer')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    expect(putCount).toBeGreaterThanOrEqual(1)
    expect(storedProject.version).toBe(3)
    expect(storedProject.workflow.entries).toEqual({})
    expect(storedProject.entries).toHaveLength(2)
    expect(storedProject.entries[0].translation).toBe('Commencer')

    // Reload now returns the stored V3 payload.
    await page.reload()
    await expect(page.getByLabel('Translation')).toHaveValue('Commencer')
  })

  test('viewer loads V2 in memory but performs zero writes', async ({ page }) => {
    await mockLegacyApi(page, 'viewer')
    await signIn(page)
    await page.goto('/app/projects/proj-1')
    await openEntries(page)
    await expect(page.locator('.entry-key').filter({ hasText: 'menu.start' })).toBeVisible()
    await openEditor(page)
    await expect(page.getByLabel('Translation')).not.toBeEditable()
    await expect(page.getByText('Read only')).toBeVisible()
    expect(putCount).toBe(0)
  })
})
