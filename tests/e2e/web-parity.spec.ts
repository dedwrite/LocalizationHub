import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const project = {
  format: 'LocalizationHubProject',
  version: 3,
  sourceFileName: 'game.json',
  selectedEntryId: null,
  tokenProfile: 'generic',
  document: { parser: 'json', format: 'flat-json-object', sourceText: '{}', language: { sourceDirection: 'ltr', translationDirection: 'ltr' } },
  entries: [
    { id: 'e0', key: 'menu.start', source: 'Start {0}', translation: 'Start {0}' },
    { id: 'e1', key: 'menu.quit', source: 'Quit', translation: '' },
    { id: 'e2', key: 'menu.settings', source: 'Settings {name}', translation: 'Paramètres' },
    { id: 'e3', key: 'menu.about', source: 'About', translation: 'À propos' },
  ],
  workflow: { entries: { e0: { status: 'approved' }, e2: { status: 'needs-review' } } },
  metadata: { tags: [{ id: 'ui', label: 'UI' }], entryTags: {}, assignments: {}, comments: [], glossary: [], translationMemory: [{ source: 'Quit', translation: 'Quitter' }] },
}

const snapshot = { id: 'proj-1', name: 'Game Project', role: 'owner', revision: 3, updatedAt: new Date().toISOString(), project }

async function mockCloudApi(page: Page, role: 'owner' | 'editor' | 'viewer' = 'owner') {
  await page.route('**/api/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'user-1', username: 'tester', email: 't@example.com', emailVerified: true, createdAt: new Date().toISOString() } }) }))
  await page.route('**/api/projects/proj-1', async (route) => {
    const snap = { ...snapshot, role }
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...snap, project: body.project, revision: snap.revision + 1 }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ project: snap }) })
  })
  await page.route('**/api/projects/proj-1/members', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: [{ id: 'user-1', username: 'tester', role: 'owner' }, { id: 'user-2', username: 'samira', role: 'editor' }] }) }))
  await page.route('**/api/projects/proj-1/assignments', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [{ entryId: 'e3', assigneeUserId: 'user-2', updatedAt: new Date().toISOString() }] }) }))
  await page.route('**/api/projects/proj-1/comments-summary', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [{ entryId: 'e2', count: 1, unresolved: 1 }] }) }))
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

test.describe('web workspace parity', () => {
  test.beforeEach(async ({ page }) => {
    const viewport = page.viewportSize()
    test.skip(Boolean(viewport && viewport.width < 768), 'desktop/tablet interaction parity')
    await mockCloudApi(page)
    await signIn(page)
  })

  test('renders the three-pane workspace layout', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await expect(page.locator('.workspace-toolbar')).toBeVisible()
    await expect(page.locator('.entries-pane')).toBeVisible()
    await expect(page.locator('.editor-pane')).toBeVisible()
    await expect(page.locator('.inspector-pane')).toBeVisible()
    await expect(page.locator('.entry-key').filter({ hasText: 'menu.start' })).toBeVisible()
  })

  test('shows entry counts and filters', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await expect(page.getByRole('tab', { name: /Untranslated/ })).toBeVisible()
    await page.getByRole('tab', { name: /Untranslated/ }).click()
    await expect(page.locator('.entry-row')).toHaveCount(1)
    await expect(page.getByText('menu.quit')).toBeVisible()
  })

  test('collapses and restores the entries pane', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await expect(page.locator('.entries-pane')).toBeVisible()
    await page.getByRole('button', { name: 'Entries' }).click()
    await expect(page.locator('.entries-pane')).toHaveCount(0)
    await page.getByRole('button', { name: 'Entries' }).click()
    await expect(page.locator('.entries-pane')).toBeVisible()
  })

  test('switches inspector tabs without horizontal overflow', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    const tabs = page.locator('.inspector-tabs')
    const scrollWidth = await tabs.evaluate((el) => el.scrollWidth)
    const clientWidth = await tabs.evaluate((el) => el.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
    await page.getByRole('tab', { name: 'Comments', exact: true }).click()
    await expect(page.getByText('No comments on this entry.')).toBeVisible()
  })

  test('shows inline protected-token QA when a token is dropped', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    // Select the entry with a dropped token (menu.settings → 'Paramètres').
    await page.locator('.entry-key').filter({ hasText: 'menu.settings' }).click()
    await expect(page.locator('.inline-qa')).toBeVisible()
    await expect(page.getByText(/Missing protected token/)).toBeVisible()
  })

  test('bulk selection enables bulk actions', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await page.locator('.entry-checkbox').first().click()
    await expect(page.locator('.bulk-bar')).toBeVisible()
    await page.getByRole('button', { name: 'Bulk actions' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('machine translation panel does not persist the API key', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await page.getByRole('button', { name: /Machine Translation Reference/ }).click()
    await page.getByPlaceholder(/Google AI Studio key/).fill('sk-test-key-123')
    const stored = await page.evaluate(() => ({ local: localStorage.getItem('localizationhub.web.mtKey'), session: sessionStorage.getItem('localizationhub.web.mtKey') }))
    expect(stored.local).toBeNull()
    expect(stored.session).toBeNull()
  })

  test('machine translation panel offers supported models with a default', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await page.getByRole('button', { name: /Machine Translation Reference/ }).click()
    const modelSelect = page.getByLabel('Model')
    await expect(modelSelect).toBeVisible()
    // Defaults to Gemini 3.6 Flash; no obsolete 1.5 model is offered.
    await expect(modelSelect).toHaveValue('gemini-3.6-flash')
    const options = await modelSelect.locator('option').allTextContents()
    expect(options.some((o) => o.includes('1.5'))).toBe(false)
    expect(options.some((o) => o.includes('3.7'))).toBe(true)
  })

  test('viewer is read-only', async ({ page }) => {
    await mockCloudApi(page, 'viewer')
    await signIn(page)
    await page.goto('/app/projects/proj-1')
    await expect(page.getByLabel('Translation')).not.toBeEditable()
    await expect(page.getByText('Read only')).toBeVisible()
  })

  test('jump to entry navigates by number', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    await page.getByRole('button', { name: /1 \/ 4/ }).click()
    await page.getByLabel('Jump to entry number').fill('3')
    await page.getByRole('button', { name: 'Go' }).click()
    await expect(page.locator('.entry-key').filter({ hasText: 'menu.settings' })).toBeVisible()
  })
})

test.describe('web workspace responsive', () => {
  test.beforeEach(async ({ page }) => {
    await mockCloudApi(page)
    await signIn(page)
  })

  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    test(`renders workspace at ${width}px without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 500 ? 800 : 900 })
      await page.goto('/app/projects/proj-1')
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(width)
    })
  }

  test('has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/app/projects/proj-1')
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
    expect(serious).toEqual([])
  })
})
