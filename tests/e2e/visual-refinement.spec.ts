import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const original = JSON.parse(readFileSync('tests/fixtures/caloy-mark.json', 'utf8'))[0]
const fixture = JSON.stringify([0, 1, 2].map(index => ({ ...original, entry_id: String(index + 1), text_en: `Line ${index + 1} {name}` })))

async function populatedRadio(page: Page) {
  await page.route('**/api/radio/**', route => {
    if (new URL(route.request().url()).pathname === '/api/radio/tracks') return route.fulfill({ json: { tracks: [{ id: 'radio-visual', title: 'A sufficiently long track title', artist: 'Synthetic artist', position: 0, durationSeconds: 180, audioUrl: '/api/radio/tracks/radio-visual/audio', artworkUrl: null }] } })
    return route.fulfill({ status: 204 })
  })
}

for (const locale of ['en', 'ar'] as const) {
  test(`populated Radio never intercepts Local navigation in ${locale}`, async ({ page }) => {
    await populatedRadio(page)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/app/local')
    await page.locator('input[type=file]').setInputFiles({ name: 'visual-review.json', mimeType: 'application/json', buffer: Buffer.from(fixture) })
    await page.locator('.lh-language-switcher select').selectOption(locale)
    await expect(page.locator('.lh-radio-capsule-title')).toHaveText('A sufficiently long track title')
    const footer = page.locator('.editor-footer')
    await expect(footer).toBeVisible()
    const collision = await footer.evaluate(element => {
      const radio = document.querySelector('.lh-radio-capsule')!.getBoundingClientRect()
      return [...element.querySelectorAll('button')].some(button => {
        const box = button.getBoundingClientRect()
        return box.left < radio.right && box.right > radio.left && box.top < radio.bottom && box.bottom > radio.top
      })
    })
    expect(collision, 'Radio must not cover even part of a navigation button').toBe(false)
    const next = footer.getByRole('button', { name: locale === 'en' ? 'Next' : 'التالي', exact: true })
    await next.click()
    await expect(page.locator('.source-text')).toContainText('Line 2')
    await footer.getByRole('button', { name: locale === 'en' ? 'Previous' : 'السابق', exact: true }).click()
    await expect(page.locator('.source-text')).toContainText('Line 1')
    if ((page.viewportSize()?.width ?? 1440) < 768) {
      await page.locator('.mob-nav button').last().click()
      await expect(page.locator('.mob-tools')).toBeVisible()
      await page.locator('.mob-nav button').first().click()
      await expect(page.locator('.mob-surface .entries-panel')).toBeVisible()
    }
    expect(errors).toEqual([])
  })
}
