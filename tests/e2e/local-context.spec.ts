import { test, expect } from '@playwright/test'

const examples = [
  { record: { scene: '1a/$.inkb', entry_id: '1', speaker: 'Sofia', speaker_gender: 'female', receiver: 'KuyaGrab', receiver_gender: 'male', text_en: 'Hello!', text_ar: '' }, en: 'Speaker: Sofia (female) · → Listener: KuyaGrab (male) · Scene: 1a/$.inkb', ar: 'المتحدث: Sofia (أنثى) · → المستمع: KuyaGrab (ذكر) · المشهد: 1a/$.inkb' },
  { record: { text: 'Hello, everyone!', sender: 'Sofia', receivers: [{ name: 'Mark', gender: 'male' }, { name: 'Ali', gender: 'male' }] }, en: 'Speaker: Sofia · → Listeners: Mark (male), Ali (male)', ar: 'المتحدث: Sofia · → المستمعون: Mark (ذكر), Ali (ذكر)' },
]
for (const [index, example] of examples.entries()) for (const locale of ['en', 'ar'] as const) test(`Local explicit dialogue ${index} survives save/reopen in ${locale}`, async ({ page }) => {
  await page.route('**/api/radio/**', (route) => route.fulfill({ json: { tracks: [] } }))
  await page.goto('/app/local')
  await page.locator('input[type="file"]').setInputFiles({ name: 'roles.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([example.record])) })
  await page.locator('.lh-language-switcher select').selectOption(locale)
  await expect(page.locator('.dialogue-context-strip > span')).toHaveText(example[locale].split(' · '))
  await page.locator('.translation-editor').focus()
  await page.keyboard.press('Control+s')
  await expect(page.locator('.toast')).toContainText(locale === 'en' ? 'Saved to this browser.' : 'حُفظ في هذا المتصفح.')
  await page.reload()
  await page.getByRole('button', { name: 'roles.json', exact: true }).click()
  await expect(page.locator('.dialogue-context-strip > span')).toHaveText(example[locale].split(' · '))
})
