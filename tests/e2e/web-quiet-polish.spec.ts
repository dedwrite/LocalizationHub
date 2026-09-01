import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const source = JSON.stringify([
  { entry_id: '1', speaker: 'Caloy', receiver: 'Mark', text_en: 'Open settings', text_ar: '' },
  { entry_id: '2', speaker: 'Mark', receiver: 'Caloy', text_en: 'Save game', text_ar: '' },
])

async function radio(page: Page) {
  await page.route('**/api/radio/**', route => new URL(route.request().url()).pathname === '/api/radio/tracks'
    ? route.fulfill({ json: { tracks: [] } })
    : route.fulfill({ status: 204 }))
}

async function openLocal(page: Page) {
  await radio(page)
  await page.goto('/app/local')
  await page.locator('input[type=file]').setInputFiles({
    name: 'quiet-synthetic.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  })
  await expect(page.locator('.source-text')).toContainText('Open settings')
}

async function accessible(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).analyze()
  expect(result.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([])
}

test('command palette opens with Ctrl/Meta+K and runs a navigation command', async ({ page }) => {
  await radio(page)
  await page.goto('/app/local')
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
  const palette = page.locator('.command-center')
  await expect(palette).toBeVisible()
  await accessible(page, '.command-center')
  await palette.locator('input').fill('Cloud')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/app\/(login|projects)/)
})

test('shortcuts center opens with ? outside text fields', async ({ page }) => {
  await radio(page)
  await page.goto('/app/local')
  await page.keyboard.press('?')
  const help = page.locator('.command-center')
  await expect(help).toBeVisible()
  await expect(help).toContainText(/Ctrl|⌘/)
  await accessible(page, '.command-center')
  await page.keyboard.press('Escape')
  await expect(help).toHaveCount(0)
})

test('project marks, length cues and quiet empty states appear in the local workspace', async ({ page }) => {
  await openLocal(page)
  await page.locator('.translation-editor').fill('Open the game settings menu now please')
  await expect(page.locator('.length-cue')).toBeVisible()
  await expect(page.locator('.length-cue')).toHaveAttribute('data-kind', /long|very-long/)
  await page.getByRole('button', { name: 'Save locally', exact: true }).click()
  await page.getByRole('button', { name: 'Back to local files', exact: true }).click()
  await expect(page.locator('.recent-local-row .project-mark')).toHaveCount(1)
  await expect(page.locator('.resume-card .project-mark, .resume-card .resume-emblem')).toHaveCount(1)
  await expect(page.locator('.time-greeting')).toBeVisible()
  await page.locator('.recent-local-row button').first().click()
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Entries', exact: true }).click()
  await page.getByRole('tab', { name: /Needs Review/i }).click()
  await expect(page.locator('.quiet-empty, .intentional-empty')).toBeVisible()
})

test('completing every entry shows the quiet completion moment', async ({ page }) => {
  await openLocal(page)
  await page.locator('.translation-editor').fill('Open settings')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.locator('.translation-editor').fill('Save game')
  await expect(page.locator('.completion-moment')).toBeVisible()
  await accessible(page, '.completion-moment')
})
