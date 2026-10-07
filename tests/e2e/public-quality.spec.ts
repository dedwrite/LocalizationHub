import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { confirmLocalExport, localToast, openEditor, openEntries, openTools } from './helpers'

test('public pages contain real React content without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  for (const path of ['/', '/product', '/privacy', '/terms', '/download']) {
    await page.goto(`${baseURL}${path}`)
    await expect(page.locator('#root main h1')).toBeVisible()
    await expect(page.locator('#root')).toHaveAttribute('data-prerendered', path)
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://localizationhub.app${path}`)
  }
  await page.goto(`${baseURL}/product`)
  await expect(page.locator('#context')).toContainText('Captain Veyra')
  await expect(page.locator('#faq details')).toHaveCount(4)
  await context.close()
})

test('hydration preserves a stored Arabic preference and SPA route metadata', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && /hydrat|Minified React error/i.test(message.text())) errors.push(message.text()) })
  await page.route('**/api/radio/**', route => route.fulfill({ json: { tracks: [] } }))
  await page.addInitScript(() => localStorage.setItem('localizationhub.ui-locale.v1', 'ar'))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('h1')).toContainText('المحرّر هو المنتج.')
  await page.locator('footer a[href="/privacy"]').click()
  await expect(page).toHaveTitle('Privacy — LocalizationHub')
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://localizationhub.app/privacy')
  await page.locator('footer a[href="/terms"]').click()
  await expect(page).toHaveTitle('Terms — LocalizationHub')
  expect(errors).toEqual([])
})

test('direct sample workspace is styled, honest, and accessible in both languages', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/radio/**', route => route.fulfill({ json: { tracks: [] } }))
  await page.goto('/app/local?sample=northern-gate')
  await expect(page.locator('.source-text')).toContainText('Hold the line')
  await expect(page.locator('.sample-workspace-guide')).toBeVisible()
  if ((page.viewportSize()?.width ?? 1440) >= 768) {
    await expect(page.locator('.entry-row').first()).toHaveCSS('display', 'flex')
    await expect(page.locator('.entry-row').first()).toHaveAttribute('aria-label', /Approved/)
  }
  expect(await page.locator('.toolbar-brand img, .mob-brand img').evaluateAll(images => images.every(image => image.getBoundingClientRect().width <= 40))).toBe(true)
  for (const locale of ['en', 'ar']) {
    await page.locator('.lh-language-switcher select').selectOption(locale)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
    const issues = await new AxeBuilder({ page }).include('main').analyze()
    expect(issues.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([])
  }
  expect(errors).toEqual([])
})

test('mobile navigation is available and closes after following a link', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 1000, 'Desktop has the full navigation')
  await page.goto('/product')
  await page.locator('.mobile-site-menu summary').click()
  await expect(page.locator('.mobile-site-menu nav')).toBeVisible()
  await page.locator('.mobile-site-menu a[href="/download"]').click()
  await expect(page).toHaveTitle('Windows app — LocalizationHub')
  await expect(page.locator('.mobile-site-menu')).not.toHaveAttribute('open')
})

test('sample tour supports real QA, local saving, reopening, and original-format export', async ({ page }) => {
  const writes: string[] = []
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.url()) })
  await page.route('**/api/radio/**', route => route.fulfill({ json: { tracks: [] } }))
  await page.goto('/app/local?sample=northern-gate')
  await expect(page.locator('.source-text')).toContainText('Hold the line')
  await openEntries(page)
  await page.getByRole('listitem', { name: 'quest.gate.reward — Error', exact: true }).click()
  await openEditor(page)
  await expect(page.locator('.inline-qa')).toContainText('Missing protected token: {gold}')
  await page.locator('.translation-editor').fill('المكافأة: {gold} ذهب')
  await expect(page.locator('.inline-qa')).toHaveCount(0)
  await page.keyboard.press('Control+s')
  await expect(localToast(page)).toContainText('Saved to this browser.')
  await openTools(page)
  const download = page.waitForEvent('download')
  await confirmLocalExport(page)
  const records = JSON.parse(readFileSync((await (await download).path())!, 'utf8'))
  expect(records).toHaveLength(24)
  expect(records.find((row: { key: string }) => row.key === 'quest.gate.reward').translation).toBe('المكافأة: {gold} ذهب')
  expect(records[0]).toMatchObject({ receiver: 'Player', speaker: 'Captain Veyra' })
  await page.goto('/app/local')
  await page.getByRole('button', { name: 'northern-gate.json', exact: true }).click()
  await openEntries(page)
  await page.getByRole('listitem', { name: /quest.gate.reward/ }).click()
  await openEditor(page)
  await expect(page.locator('.translation-editor')).toHaveValue('المكافأة: {gold} ذهب')
  expect(writes).toEqual([])
})
