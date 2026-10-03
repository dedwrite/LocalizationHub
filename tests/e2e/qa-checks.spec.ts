import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { openEditor, openEntries } from './helpers'

/*
 * The translation QA checks own their rules in `packages/core` and their unit
 * tests beside it. This spec is the honest half of that: the finding has to
 * reach the translator — the editor row, the live status line, the warning
 * filter and its count, and the Arabic copy with the value isolated.
 */

const raw = readFileSync('tests/fixtures/caloy-mark.json', 'utf8')
const WORKSPACE = ['desktop', 'phone-390']

async function openLocalProject(page: Page) {
  await page.goto('/app/local')
  await page.locator('input[type="file"]').setInputFiles({ name: 'caloy-mark.json', mimeType: 'text/plain', buffer: Buffer.from(raw) })
  await expect(page.locator('.source-text')).toBeVisible()
  await openEditor(page)
}

test('the editor reports what the translation lost and announces it', async ({ page }, testInfo) => {
  test.skip(!WORKSPACE.includes(testInfo.project.name), 'the editor is covered on desktop and phone')
  await openLocalProject(page)
  const editor = page.locator('.translation-editor')
  // The source is "[shake rate=32 level=8]W-woohoo! L-look at us, team![/shake]".
  await editor.fill('[shake rate=32 level=8]مرحبا![/shake]')
  await expect(page.locator('.inline-qa-item')).toHaveCount(0)
  await editor.fill('[shake rate=32 level=8]مرحبا[/shake]')
  const item = page.locator('.inline-qa-item').first()
  await expect(item).toHaveClass(/qa-warning/)
  await expect(item).toContainText('ends with "!"')
  await expect(page.locator('#translation-check')).toHaveText(/ends with "!"/)
  // Arabic says it in Arabic and keeps the machine value LTR.
  await page.locator('.lh-language-switcher select').selectOption('ar')
  await expect(item).toContainText('علامة ترقيم')
  await expect(item.locator('code')).toHaveText('!')
  await expect(item.locator('code')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('#translation-check')).toContainText('علامة ترقيم')
})

test('the warning queue filters, counts and marks the entry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the desktop layout shows the queue and the editor together')
  await openLocalProject(page)
  await page.locator('.translation-editor').fill('[shake rate=32 level=8]مرحبا[/shake]')
  await expect(page.locator('.count-pill.count-warning')).toHaveText('1')
  await openEntries(page)
  await page.locator('.entries-filters').getByRole('tab', { name: /Warnings/ }).click()
  await expect(page.locator('.entry-row')).toHaveCount(1)
  await expect(page.locator('.entry-flag.flag-warning')).toBeVisible()
  // A translation that keeps the mark leaves the queue empty again.
  await openEditor(page)
  await page.locator('.translation-editor').fill('[shake rate=32 level=8]مرحبا![/shake]')
  await expect(page.locator('.count-pill.count-warning')).toHaveCount(0)
})
