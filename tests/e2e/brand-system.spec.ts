import { test, expect } from '@playwright/test'

test('brand variants load across public pages and local editor', async ({ page }) => {
  for (const route of ['/', '/product', '/download', '/privacy', '/app/local?sample=northern-gate']) {
    await page.goto(route)
    const marks = page.locator('img[src^="/brand-"]')
    await expect(marks.first()).toBeVisible()
    await expect.poll(() => marks.evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
    await expect(page.locator('img[src*="localizationhub-logo"], img[src*="logo-center"]')).toHaveCount(0)
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/brand-app.png')
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('type', 'image/png')
  }
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest.icons.every((icon: { src: string }) => icon.src.startsWith('/brand-'))).toBe(true)
})
