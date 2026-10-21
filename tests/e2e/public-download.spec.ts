import {test, expect} from '@playwright/test'

for (const locale of ['en', 'ar']) test(`anonymous Windows download and checksum are usable in ${locale}`, async ({page}) => {
  await page.addInitScript(value => localStorage.setItem('localizationhub.ui-locale.v1', value), locale)
  await page.goto('/download')
  const installer = page.getByRole('link', {name: locale === 'en' ? 'Download for Windows' : 'تنزيل لويندوز', exact: true})
  await expect(installer).toHaveAttribute('href', 'https://github.com/dedwrite/LocalizationHub/releases/download/v0.9.10/LocalizationHub_0.9.10_x64-setup.exe')
  await expect(installer).toBeVisible()
  await expect(page.locator('main')).toContainText('v0.9.10')
  await expect(page.locator('main')).toContainText('SmartScreen')
  await expect(page.locator('a[href$=".sha256"]').last()).toBeVisible()
  await page.locator('.download-verification summary').click()
  await expect(page.locator('.download-digest')).toHaveText('9ddc36bbde45fea0c198c5549f09b6380b27b271a9833a210c4f07ca10e64495')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0)
  await page.goto('/')
  await expect(page.locator('a[href="/download"]')).toBeVisible()
})
