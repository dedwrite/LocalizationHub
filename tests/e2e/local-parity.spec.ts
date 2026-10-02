import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { confirmLocalExport, localToast, openEditor, openEntries, openTools } from './helpers'
import { parseLocalizationFile } from '../../packages/core/src/parsers'
import AxeBuilder from '@axe-core/playwright'

const raw = readFileSync('tests/fixtures/caloy-mark.json', 'utf8')
// The workspace fades its panels in when it opens. Colour-contrast audits must
// read the resting state, not one frame of that 220ms settle (continuous
// decorations such as the Radio disc are excluded: they never finish).
const animationsSettled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((animation) => {
  const timing = animation.effect?.getComputedTiming()
  return animation.playState !== 'running' || timing?.iterations === Infinity
}))
async function openLocal(page: Page, text = raw, name = 'caloy-mark.json') {
  await page.goto('/app/local')
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) })
  await expect(page.locator('.source-text')).toBeVisible()
}
test.beforeEach(async ({ page }) => { await page.route('**/api/radio/**', (route) => route.fulfill({ json: { tracks: [] } })) })

for (const locale of ['en', 'ar'] as const) test(`Local editing, profiles, workflow, save/reopen and export stay local in ${locale}`, async ({ page }) => {
  const requests: string[] = []; const errors: string[] = []
  page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/api/') && !request.url().includes('/api/radio/')) requests.push(request.url()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await openLocal(page)
  await page.locator('.lh-language-switcher select').selectOption(locale)
  await expect(page.locator('.dialogue-context-strip')).toContainText('Mark')
  await expect(page.locator('.dialogue-context-strip')).toContainText(locale === 'en' ? 'Listener:' : 'المستمع:')
  await expect(page.locator('.source-text .protected-token')).toHaveCount(2)
  // Unstarted entries are not broken translations. QA begins with a draft.
  await expect(page.locator('.inline-qa')).toHaveCount(0)
  await page.locator('.translation-editor').fill('Draft without protected tokens')
  await expect(page.locator('.inline-qa')).toBeVisible()
  const translation = '[shake rate=32 level=8]مرحبا![/shake]'
  await page.locator('.translation-editor').fill(translation)
  await expect(page.locator('.inline-qa')).toHaveCount(0)
  const workflow = page.locator('.mob-workflow:visible, .status-select:visible')
  await workflow.getByRole('button', { name: locale === 'en' ? 'Approved' : 'معتمد', exact: true }).click()
  await page.locator('.lh-language-switcher select').selectOption('en')
  if ((page.viewportSize()?.width ?? 0) < 768) await openTools(page)
  await page.getByLabel('Token profile', { exact: true }).selectOption('unity')
  await page.keyboard.press('Control+s')
  await expect(localToast(page)).toContainText('Saved to this browser.')
  expect(requests).toEqual([])
  await page.reload()
  await page.getByRole('button', { name: 'caloy-mark.json', exact: true }).click()
  await openEditor(page)
  await expect(page.locator('.translation-editor')).toHaveValue(translation)
  await expect(page.locator('.dialogue-context-strip')).toContainText('Mark')
  await expect(page.locator('.mob-workflow-option.active:visible, .status-option.active:visible')).toHaveText('Approved')
  if ((page.viewportSize()?.width ?? 0) < 768) await openTools(page)
  await expect(page.getByLabel('Token profile', { exact: true })).toHaveValue('unity')
  await expect(page.getByRole('tab', { name: 'Comments', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Collaboration', exact: true })).toHaveCount(0)
  const download = page.waitForEvent('download')
  await confirmLocalExport(page)
  const file = await download
  expect(file.suggestedFilename()).toBe('caloy-mark.json')
  const exported = JSON.parse(readFileSync((await file.path())!, 'utf8'))
  expect(exported[0]).toMatchObject({ receiver: 'Mark', text_ar: translation })
  expect(Array.isArray(exported)).toBe(true)
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('legacy browser copy migration preserves data without rewriting storage on open', async ({ page }) => {
  const parsed = parseLocalizationFile(raw, 'legacy.json')
  if (!parsed.ok) throw new Error(parsed.reason)
  parsed.document.entries[0].translation = '[shake rate=32 level=8]قديم[/shake]'
  await page.goto('/app/local')
  await page.evaluate(async (document) => {
    await new Promise<void>((resolve, reject) => { const open = indexedDB.open('localizationhub-web-local', 1); open.onupgradeneeded = () => open.result.createObjectStore('projects', { keyPath: 'id' }); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put({ id: 'legacy.json:json', value: document, savedAt: '2026-08-30T00:00:00Z' }); tx.oncomplete = () => { db.close(); resolve() } } })
  }, parsed.document)
  await page.reload()
  await page.getByRole('button', { name: 'legacy.json', exact: true }).click()
  await expect(page.locator('.translation-editor')).toHaveValue(parsed.document.entries[0].translation)
  await expect(page.locator('.dialogue-context-strip')).toContainText('Mark')
  const stored = await page.evaluate(async () => new Promise<any>((resolve) => { const open = indexedDB.open('localizationhub-web-local', 1); open.onsuccess = () => { const db = open.result; const get = db.transaction('projects').objectStore('projects').get('legacy.json:json'); get.onsuccess = () => { db.close(); resolve(get.result) } } }))
  expect(stored.value).toEqual(parsed.document)
  await page.keyboard.press('Control+s')
  await expect(localToast(page)).toContainText('Saved to this browser.')
  await page.reload()
  await expect(page.getByRole('button', { name: 'legacy.json', exact: true })).toHaveCount(1)
})

test('unsaved edits survive cancelled navigation and local-copy deletion is deliberate', async ({ page }) => {
  await openLocal(page)
  await page.locator('.translation-editor').fill('Keep this draft')
  await page.locator('.toolbar-brand:visible, .mob-back:visible').click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('.translation-editor')).toHaveValue('Keep this draft')
  await page.keyboard.press('Control+s')
  await expect(localToast(page)).toContainText('Saved to this browser.')
  await page.locator('.toolbar-brand:visible, .mob-back:visible').click()
  await page.getByRole('button', { name: 'Delete local copy', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'caloy-mark.json', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete local copy', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete local copy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'caloy-mark.json', exact: true })).toHaveCount(0)
})

test('large local project is virtualized and search/navigation stay usable', async ({ page }) => {
  const rows = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), text_en: `Synthetic entry ${index} {name}`, text_ar: '' }))
  await openLocal(page, JSON.stringify(rows), 'large.json')
  await openEntries(page)
  expect(await page.locator('.entry-row').count()).toBeLessThan(100)
  await page.getByRole('searchbox', { name: 'Search entries' }).fill('Synthetic entry 9999')
  await expect(page.locator('.entry-row')).toHaveCount(1)
  await page.locator('.entry-row').click()
  await openEditor(page)
  await expect(page.locator('.source-text')).toContainText('9999')
  await page.keyboard.press('Alt+ArrowUp')
  await expect(page.locator('.source-text')).toContainText('9998')
})

test('local MT is explicit, sends only current text/context, and never saves to Cloud', async ({ page }) => {
  const calls: any[] = []; const cloud: string[] = []
  page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/api/projects')) cloud.push(request.url()) })
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => { calls.push(route.request().postDataJSON()); await route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'مرجع اختباري' }] } }] } }) })
  await openLocal(page, JSON.stringify([...JSON.parse(raw), { id: 'private-other', text_en: 'UNRELATED_ENTRY_MUST_NOT_BE_SENT', text_ar: '' }]))
  await page.locator('.mt-toggle').click()
  await expect(page.locator('.local-mt-privacy')).toBeVisible()
  await page.locator('input[name="mt-provider-key"]').fill('synthetic-test-key')
  expect(calls).toEqual([])
  await page.locator('.mt-actions button').first().click()
  await expect(page.locator('.mt-result')).toBeVisible()
  expect(calls).toHaveLength(1)
  expect(JSON.stringify(calls[0])).toContain('Listener: Mark (male)')
  expect(JSON.stringify(calls[0])).not.toContain('UNRELATED_ENTRY_MUST_NOT_BE_SENT')
  expect(cloud).toEqual([])
})

test('Local workspace responsive RTL, token errors, keyboard focus and accessibility', async ({ page }, testInfo) => {
  // This test performs an axe scan and full-page capture for each locale/size,
  // unlike the single interaction cases. Leave WebKit enough capture time.
  test.setTimeout(60_000)
  const widths = testInfo.project.name === 'desktop' ? [1440, 1280] : [page.viewportSize()!.width]
  await openLocal(page)
  await page.locator('.translation-editor').fill('ترجمة تحتاج إلى رموز المصدر')
  for (const width of widths) for (const locale of ['en', 'ar']) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 })
    await page.locator('.lh-language-switcher select').selectOption(locale)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.locator('.source-text')).toBeVisible()
    await expect(page.locator('.translation-editor')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('.source-text')).toHaveAttribute('dir', 'ltr')
    await expect(page.locator('.inline-qa')).toContainText(locale === 'ar' ? 'الرمز المحمي المفقود' : 'Missing protected token')
    await expect(page.locator('.source-token-list code')).toHaveCount(2)
    await expect(page.locator('.source-section .section-label')).toHaveText(locale === 'ar' ? 'المرجع المصدر' : 'REFERENCE Source')
    await expect(page.locator('.translation-section .section-label')).toHaveText(locale === 'ar' ? 'نسخة العمل الترجمة' : 'WORKING COPY Translation')
    await animationsSettled(page)
    const result = await new AxeBuilder({ page }).analyze()
    expect(result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`local-${width}-${locale}.png`), fullPage: true })
  }
  await page.locator('.lh-language-switcher select').selectOption('en')
  await expect(page.locator('.source-section .section-label')).toHaveText('REFERENCE Source')
  await expect(page.locator('.translation-section .section-label')).toHaveText('WORKING COPY Translation')
})

test('browser Back protects a fresh unsaved local import', async ({ page }) => {
  await page.goto('/app/local')
  // Same-document history, as used by the app router. Cross-document leaving
  // is independently protected by beforeunload (browser-native dialog).
  await page.evaluate(() => { history.replaceState({}, '', '/'); history.pushState({}, '', '/app/local') })
  await page.locator('input[type="file"]').setInputFiles({ name: 'back.json', mimeType: 'text/plain', buffer: Buffer.from(raw) })
  await expect(page.locator('.translation-editor')).toBeVisible()
  await page.locator('.translation-editor').fill('unsaved back test')
  await page.goBack()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('.translation-editor')).toHaveValue('unsaved back test')
  await expect(page).toHaveURL(/\/app\/local$/)
})

test('quota failure preserves unsaved work and allows original-format backup export', async ({ page }) => {
  await openLocal(page)
  await page.locator('.translation-editor').fill('backup translation')
  await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException('Synthetic quota failure', 'QuotaExceededError') } })
  await page.keyboard.press('Control+s')
  await expect(localToast(page)).toContainText('Keep this view open and export a backup')
  await expect(page.locator('.translation-editor')).toHaveValue('backup translation')
  await openTools(page)
  const download = page.waitForEvent('download')
  await confirmLocalExport(page)
  expect(JSON.parse(readFileSync((await (await download).path())!, 'utf8'))[0].text_ar).toBe('backup translation')
})

test('navigation, selected entry and all five profile choices remain local', async ({ page }) => {
  await openLocal(page, '{"one":"One {name}","two":"Two {name}","three":"Three {name}"}', 'navigation.json')
  await page.locator('.translation-editor').focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect(page.locator('.source-text')).toContainText('Two')
  await page.keyboard.press('Control+Enter')
  await expect(page.locator('.source-text')).toContainText('Three')
  await page.keyboard.press('Control+Shift+Enter')
  await expect(page.locator('.source-text')).toContainText('Two')
  await openTools(page)
  for (const profile of ['generic', 'godot', 'unreal', 'unity', 'auto']) {
    await page.getByLabel('Token profile', { exact: true }).selectOption(profile)
    await expect(page.getByLabel('Token profile', { exact: true })).toHaveValue(profile)
  }
  await page.keyboard.press('Control+s')
  await expect(localToast(page)).toContainText('Saved to this browser.')
  await page.reload()
  await page.getByRole('button', { name: 'navigation.json', exact: true }).click()
  await expect(page.locator('.source-text')).toContainText('Two')
})
