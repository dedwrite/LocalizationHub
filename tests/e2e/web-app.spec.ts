import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const jsonFile = { name: 'browser.json', mimeType: 'application/json', buffer: Buffer.from('{"menu.start":"Start","menu.quit":"Quit"}') }
const csvFile = { name: 'browser.csv', mimeType: 'text/csv', buffer: Buffer.from('key,source,translation\nmenu.start,Start,\n') }
const poFile = { name: 'browser.po', mimeType: 'text/plain', buffer: Buffer.from('msgid "Start"\nmsgstr ""\n') }

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
    await page.getByRole('button', { name: 'browser.json:json', exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export' }).click()
    const content = await (await download).createReadStream()
    expect(content).not.toBeNull()
  })

  test('imports and exports CSV', async ({ page }) => {
    await importFile(page, csvFile)
    await page.locator('textarea').fill('Start translated')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export' }).click()
    expect((await (await download).createReadStream())?.readable).toBe(true)
  })

  test('imports and exports PO', async ({ page }) => {
    await importFile(page, poFile)
    await page.locator('textarea').fill('Commencer')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export' }).click()
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
