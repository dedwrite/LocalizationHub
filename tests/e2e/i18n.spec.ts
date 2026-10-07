import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('English/Arabic UI preference', () => {
  test('defaults to English, persists Arabic, and switches back', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await page.getByRole('combobox', { name: 'Interface language' }).selectOption('ar')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { name: 'المحرّر هو المنتج.' })).toBeVisible()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await page.getByRole('combobox', { name: 'لغة الواجهة' }).selectOption('en')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: 'The editor is the product.' })).toBeVisible()
  })

  test('Arabic public surfaces stay within the viewport and pass accessibility checks', async ({ page }) => {
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 800 : 900 })
      await page.goto('/')
      await page.locator('.lh-language-switcher select').selectOption('ar')
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
    await page.goto('/app/local')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')).toEqual([])
  })
})
