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
    name: 'workflow-synthetic.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  })
  await expect(page.locator('.source-text')).toContainText('Open settings')
}

async function accessible(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).analyze()
  expect(result.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([])
}

test('command palette jumps to an entry by source text', async ({ page }) => {
  await openLocal(page)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
  const palette = page.locator('.command-palette')
  await expect(palette).toBeVisible()
  await palette.locator('input').fill('Save game')
  await expect(palette.getByRole('option').first()).toContainText(/Save|menu|Go to/i)
  await page.keyboard.press('Enter')
  await expect(page.locator('.source-text')).toContainText('Save game')
})

test('export opens a quiet checklist before downloading', async ({ page }) => {
  await openLocal(page)
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.locator('.export-checklist-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.export-checklist li')).toHaveCount(6)
  await accessible(page, '.export-checklist-dialog')
  await dialog.getByRole('button', { name: /Export file|تصدير/ }).click()
  await expect(dialog).toHaveCount(0)
})

test('progress pulse appears after the first translated entry this session', async ({ page }) => {
  await openLocal(page)
  await page.locator('.translation-editor').fill('Open settings')
  await expect(page.locator('.progress-pulse')).toBeVisible()
  await expect(page.locator('.progress-pulse')).toContainText(/\+1|جلسة|session|Today|اليوم/i)
  await accessible(page, '.progress-pulse')
})
