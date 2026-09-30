import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { confirmLocalExport, openTools } from './helpers'

const jsonFile = { name: 'browser.json', mimeType: 'application/json', buffer: Buffer.from('{"menu.start":"Start","menu.quit":"Quit"}') }
const csvFile = { name: 'browser.csv', mimeType: 'text/csv', buffer: Buffer.from('key,source,translation\nmenu.start,Start,\n') }
const poFile = { name: 'browser.po', mimeType: 'text/plain', buffer: Buffer.from('msgid "Start"\nmsgstr ""\n') }

const testUser = { id: 'visual-user', username: 'reviewer', email: 'reviewer@example.com', emailVerified: true, createdAt: '2026-08-29T09:00:00Z' }

async function mockCloudWorkspace(page: any, projects: any[]) {
  await page.route('**/api/auth/me', async (route: any) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: testUser }) }))
  await page.route('**/api/projects', async (route: any) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projects }) }))
  await page.addInitScript(() => {
    localStorage.setItem('localizationhub.auth.token', 'visual-test-token')
    localStorage.setItem('localizationhub.auth.user', JSON.stringify({ id: 'visual-user', username: 'reviewer', email: 'reviewer@example.com', emailVerified: true, createdAt: '2026-08-29T09:00:00Z' }))
  })
}

async function importFile(page: any, file: any) {
  await page.goto('/app/local')
  await page.locator('input[type="file"]').setInputFiles(file)
  await expect(page.locator('textarea')).toBeVisible()
}

test.describe('public routing and accessibility', () => {
  test('serves public and deep-linked app routes', async ({ page }) => {
    for (const path of ['/', '/download', '/privacy', '/terms', '/app', '/app/login', '/app/register', '/app/projects', '/app/local', '/app/projects/deep-link']) {
      await page.goto(path)
      await expect(page.locator('body')).toBeVisible()
    }
    await page.goto('/app/local')
    await page.goBack()
    await page.goForward()
    await expect(page).toHaveURL(/\/app\/local$/)
  })

  test('has no serious or critical accessibility violations on local mode', async ({ page }) => {
    await page.goto('/app/local')
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')
    expect(serious).toEqual([])
  })

  test('Landing communicates extraction, context, and protected syntax', async ({ page }) => {
    await page.goto('/#extraction')
    await page.locator('.extraction-details summary').click()
    await expect(page.getByRole('heading', { name: 'Game folder', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Godot', exact: true })).toBeVisible()
    await expect(page.getByText('READ-ONLY EXTRACTION').first()).toBeVisible()
    await page.goto('/#context')
    await expect(page.getByRole('heading', { name: 'Keep the context. Keep the code intact.' })).toBeVisible()
    await expect(page.getByText('TOKENS VALID')).toBeVisible()
    await expect(page.locator('.rtl-showcase-source mark')).toHaveText('{player_name}')
    await expect(page.getByText('Captain Veyra')).toBeVisible()
    await expect(page.locator('.rtl-showcase-context')).toContainText('Northern Gate')
  })

  test('Landing FAQ explains Windows repository access', async ({ page }) => {
    await page.goto('/#faq')
    const answer = page.locator('.faq-list details').first().locator('p')
    await expect(answer).toContainText('private GitHub repository')
    await expect(answer).toContainText('web editor is available to everyone')
  })

  test('honors reduced motion while keeping Landing content visible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Your game. Your words.' })).toBeVisible()
    await expect(page.locator('.format-options button')).toHaveCount(4)
    const state = await page.locator('.format-result-copy').evaluate((element: HTMLElement) => ({ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform }))
    expect(state.opacity).toBe('1')
    expect(state.transform).toBe('none')
  })
})

test.describe('Visual Batch 2 project surfaces', () => {
  test('renders real project metadata and makes Cloud/Local context explicit', async ({ page }) => {
    await mockCloudWorkspace(page, [{ id: 'p1', name: 'RPG Localization', role: 'owner', revision: 8, updatedAt: '2026-08-28T09:00:00Z', sourceFileName: 'dialogue.json', entryCount: 120, translatedCount: 30, memberCount: 2 }])
    await page.goto('/app/projects')
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('120', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open RPG Localization' })).toBeVisible()
    await expect(page.locator('.projects-page .app-context-nav button.active')).toHaveAttribute('aria-current', 'page')
    if ((page.viewportSize()?.width ?? 1000) <= 767) await page.getByRole('button', { name: 'Local browser' }).click()
    else await page.locator('.projects-page .app-context-nav button').nth(1).click()
    await expect(page).toHaveURL(/\/app\/local$/)
    await expect(page.getByText('LOCAL PROJECTS / NO ACCOUNT REQUIRED')).toBeVisible()
  })

  test('makes the empty Cloud Projects state intentional and actionable', async ({ page }) => {
    await mockCloudWorkspace(page, [])
    await page.goto('/app/projects')
    await expect(page.getByText('No Cloud Projects yet.')).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Create your first project' })).toBeVisible()
    await expect(page.locator('.empty-constellation')).toBeVisible()
  })

  test('gives a single real project useful context and actions', async ({ page }) => {
    await mockCloudWorkspace(page, [{ id: 'p1', name: 'RPG Localization', role: 'owner', revision: 8, updatedAt: '2026-08-28T09:00:00Z', sourceFileName: 'dialogue.json', entryCount: 120, translatedCount: 30, memberCount: 2 }])
    await page.goto('/app/projects')
    await expect(page.locator('.single-project-layout')).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Project quick actions' })).toContainText('30 of 120 entries translated')
    await expect(page.getByRole('button', { name: 'Open project' })).toBeVisible()
  })

  test('uses a balanced grid for several real projects', async ({ page }) => {
    const projects = Array.from({ length: 4 }, (_, index) => ({ id: `p${index}`, name: `Project ${index + 1}`, role: 'editor', revision: index + 1, updatedAt: '2026-08-28T09:00:00Z', sourceFileName: `file-${index}.json`, entryCount: 40 + index, translatedCount: index * 4, memberCount: 2 }))
    await mockCloudWorkspace(page, projects)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/app/projects')
    await expect(page.locator('.project-layout:not(.single-project-layout) .project-card')).toHaveCount(4)
    const widths = await page.locator('.project-card').evaluateAll((cards) => cards.map((card) => Math.round((card as HTMLElement).getBoundingClientRect().width)))
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2)
  })
})

test.describe('browser-local files', () => {
  test('imports, edits, recovers, and exports JSON by keyboard', async ({ page }) => {
    await importFile(page, jsonFile)
    await page.locator('textarea').focus()
    await page.keyboard.type(' translated')
    await page.getByRole('button', { name: 'Save locally' }).click()
    await expect(page.getByText('Saved to this browser.')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Recent browser projects')).toBeVisible()
    await page.getByRole('button', { name: 'browser.json', exact: true }).click()
    await openTools(page)
    const download = page.waitForEvent('download')
    await confirmLocalExport(page)
    const content = await (await download).createReadStream()
    expect(content).not.toBeNull()
  })

  test('imports and exports CSV', async ({ page }) => {
    await importFile(page, csvFile)
    await page.locator('textarea').fill('Start translated')
    await openTools(page)
    const download = page.waitForEvent('download')
    await confirmLocalExport(page)
    expect((await (await download).createReadStream())?.readable).toBe(true)
  })

  test('imports and exports PO', async ({ page }) => {
    await importFile(page, poFile)
    await page.locator('textarea').fill('Commencer')
    await openTools(page)
    const download = page.waitForEvent('download')
    await confirmLocalExport(page)
    expect((await (await download).createReadStream())?.readable).toBe(true)
  })

  test('shows malformed file errors without leaving local mode', async ({ page }) => {
    await page.goto('/app/local')
    await page.locator('input[type="file"]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') })
    await expect(page.locator('.notice')).toBeVisible()
  })
})

test.describe('required viewports', () => {
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    test(`renders local workspace at ${width}px without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 500 ? 800 : 900 })
      await page.goto('/app/local')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      if (width === 360) await expect(page.getByText('LOCAL BROWSER PROJECT')).toBeVisible()
    })
  }
})
