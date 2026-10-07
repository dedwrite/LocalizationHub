import { expect, test } from '@playwright/test'

const source = JSON.stringify([
  { entry_id: '1', speaker: 'Sofia', speaker_gender: 'female', receiver: 'KuyaGrab', receiver_gender: 'male', text_en: 'Hello!', text_ar: '' },
])

test('dialogue chips distinguish speaker from listener and DeepL is selectable', async ({ page }) => {
  await page.route('**/api/radio/**', route => route.fulfill({ json: { tracks: [] } }))
  await page.goto('/app/local')
  await page.locator('input[type=file]').setInputFiles({
    name: 'parity-dialogue.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  })
  const strip = page.locator('.dialogue-context-strip')
  await expect(strip.locator('[data-role="speaker"]')).toContainText('Sofia')
  await expect(strip.locator('[data-role="listener"]')).toContainText('KuyaGrab')
  await page.locator('.mt-toggle').click()
  await page.locator('.mt-grid select').first().selectOption('deepl')
  await expect(page.locator('input[name="mt-provider-key"]')).toHaveAttribute('placeholder', /DeepL/i)
  await expect(page.locator('.mt-warning')).toContainText(/LocalizationHub forwards|يمرّ/i)
})

test('public header hosts the language switcher quietly', async ({ page }) => {
  await page.goto('/')
  const header = page.locator('.home-header')
  await expect(header.locator('.lh-language-switcher')).toBeVisible()
  // The docked variant belongs to the app surfaces, not the public landing.
  await expect(page.locator('.lh-language-switcher.is-dock')).toHaveCount(0)
})
