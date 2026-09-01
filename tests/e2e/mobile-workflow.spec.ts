import { expect, test, type Page } from '@playwright/test'
import { isMobileViewport, openEntries, openEditor, openTools } from './helpers'

const project = {
  format: 'LocalizationHubProject',
  version: 3,
  sourceFileName: 'game.json',
  selectedEntryId: null,
  tokenProfile: 'generic',
  document: { parser: 'json', format: 'flat-json-object', sourceText: '{}', language: { sourceDirection: 'ltr', translationDirection: 'rtl' } },
  entries: [
    { id: 'e0', key: 'menu.start', source: 'Start the game {0}', translation: '' },
    { id: 'e1', key: 'menu.quit', source: 'Quit the application', translation: 'إنهاء' },
    { id: 'e2', key: 'menu.settings', source: 'Adjust the game settings and graphics options', translation: 'ضبط إعدادات اللعبة' },
    { id: 'e3', key: 'menu.about', source: 'About this software build', translation: '' },
  ],
  workflow: { entries: { e2: { status: 'needs-review' } } },
  metadata: { tags: [{ id: 'ui', label: 'UI' }], entryTags: {}, assignments: {}, comments: [], glossary: [], translationMemory: [{ source: 'Quit the application', translation: 'إنهاء' }] },
}

async function mock(page: Page) {
  await page.route('**/api/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'user-1', username: 'tester', email: 't@example.com', emailVerified: true, createdAt: new Date().toISOString() } }) }))
  await page.route('**/api/projects/proj-1', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: { id: 'proj-1', name: 'Game Project', role: 'owner', revision: 4, updatedAt: new Date().toISOString(), project: body.project } }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: { id: 'proj-1', name: 'Game Project', role: 'owner', revision: 3, updatedAt: new Date().toISOString(), project } }) })
  })
  await page.route('**/api/projects/proj-1/members', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: [{ id: 'user-1', username: 'tester', role: 'owner' }] }) }))
  await page.route('**/api/projects/proj-1/assignments', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [] }) }))
  await page.route('**/api/projects/proj-1/comments-summary', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) }))
  await page.route('**/api/projects/proj-1/entries/*/comments', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [] }) }))
  await page.route('**/api/projects/proj-1/activity**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activity: [] }) }))
}

async function signIn(page: Page) {
  await page.goto('/app/login')
  await page.evaluate(() => {
    localStorage.setItem('localizationhub.auth.token', 't')
    localStorage.setItem('localizationhub.auth.user', JSON.stringify({ id: 'user-1', username: 'tester', email: 't@example.com', emailVerified: true, createdAt: new Date().toISOString() }))
  })
}

test.describe('mobile workflow', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!isMobileViewport(page), 'mobile-only workspace (viewport >= 768 uses the desktop layout)')
    await mock(page)
    await signIn(page)
  })

  test('full phone translation flow reaches Editor, edits, saves, and opens Tools', async ({ page }) => {
    await page.goto('/app/projects/proj-1')

    // Editor is the default surface with the first entry.
    await expect(page.getByRole('textbox', { name: 'Translation', exact: true })).toBeVisible()

    // Browse Entries, search, select a different entry.
    await openEntries(page)
    await expect(page.locator('.mob-entries-summary')).toBeVisible()
    await page.getByLabel('Search entries').fill('settings')
    await expect(page.locator('.entry-key').filter({ hasText: 'menu.settings' })).toBeVisible()
    await page.locator('.entry-row', { hasText: 'menu.settings' }).click()

    // Selecting an entry returns to the Editor.
    await expect(page.getByRole('textbox', { name: 'Translation', exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: 'Translation', exact: true }).fill('مُحدّث')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    // Change workflow status.
    await page.getByRole('button', { name: 'Translated', exact: true }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    // Open Tools → Inspector and come back.
    await openTools(page)
    await expect(page.getByRole('tab', { name: 'Workflow', exact: true })).toBeVisible()
    await openEditor(page)
    await expect(page.getByRole('textbox', { name: 'Translation', exact: true })).toBeVisible()
  })

  test('RTL Arabic translation text is directionally correct', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await page.locator('.entry-key').count() // ensure loaded via editor default
    // Source is LTR, translation is RTL (project translationDirection: rtl).
    const dir = await page.getByRole('textbox', { name: 'Translation', exact: true }).getAttribute('dir')
    expect(dir).toBe('rtl')
  })

  test('mobile editor does not auto-zoom inputs below 16px', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    const fontSize = await page.getByRole('textbox', { name: 'Translation', exact: true }).evaluate((el) => getComputedStyle(el).fontSize)
    expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16)
  })

  test('bottom nav touch targets are comfortable', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    for (const label of ['Entries', 'Editor', 'Tools']) {
      const box = await page.locator('.mob-nav button', { hasText: label }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('no horizontal overflow at every phone width', async ({ page }) => {
    for (const width of [375, 390, 393, 414, 430]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/app/projects/proj-1')
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(width)
    }
  })

  test('notice toast does not overlap the bottom nav', async ({ page }) => {
    // A legacy project triggers a notice toast; it must sit above the nav.
    await page.route('**/api/projects/proj-1', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: { id: 'proj-1', name: 'Game Project', role: 'owner', revision: 3, updatedAt: new Date().toISOString(), project: { ...project, version: 2 } } }) }))
    await page.goto('/app/projects/proj-1')
    await expect(page.getByText(/Legacy Project V2 loaded/)).toBeVisible()
    const toast = await page.getByRole('status').boundingBox()
    const nav = await page.locator('.mob-nav').boundingBox()
    expect(toast).not.toBeNull()
    expect(nav).not.toBeNull()
    expect(toast!.y + toast!.height).toBeLessThanOrEqual(nav!.y + 1)
  })
})
