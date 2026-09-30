import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseLocalizationFile } from '@localizationhub/core'
import { projectFromLocalDocument } from '../../website/src/localProjects'

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

test('landing preview preserves edits across UI locales, with bounded section spacing', async ({ page }) => {
  await populatedRadio(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.site-header')).toBeVisible()
  await expect(page.locator('.format-options button')).toHaveCount(4)
  expect(await page.locator('.site-header, .format-guide').evaluateAll(elements => elements.every(element => {
    const box = element.getBoundingClientRect()
    return box.left >= 0 && box.right <= document.documentElement.clientWidth
  }))).toBe(true)
  await expect(page.locator('.sample-downloads a[download]')).toHaveCount(3)
  const preview = page.locator('.live-preview')
  await preview.locator('textarea').fill('تجربة {player_name}.')
  await page.locator('.lh-language-switcher select').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(preview.locator('textarea')).toHaveValue('تجربة {player_name}.')
  await expect(preview.getByRole('status')).toContainText('الرموز سليمة.')
  await preview.locator('textarea').fill('تجربة')
  await expect(preview.getByRole('status')).toContainText('رمز محمي ناقص أو تغيّر.')
  await page.locator('.lh-language-switcher select').selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(preview.locator('textarea')).toHaveValue('تجربة')
  await expect(preview.getByRole('status')).toContainText('A protected token is missing or changed.')
  await expect(preview.locator('.preview-token-guide [data-missing="true"]')).toContainText('{player_name}')
  await preview.getByRole('button', { name: 'Restore example', exact: true }).click()
  await expect(preview.getByRole('status')).toContainText('Token check passed.')
  await page.getByRole('button', { name: 'Unity', exact: true }).click()
  await expect(page.locator('.format-result')).toContainText('Extraction depends on the type information available in the files.')
  await expect(page.locator('.format-result a')).toHaveAttribute('href', '/download')
  const spacings = await page.locator('.landing-main .section').evaluateAll(elements => elements.map(e => parseFloat(getComputedStyle(e).paddingTop)))
  expect(Math.max(...spacings)).toBeLessThanOrEqual(104)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
})

for (const locale of ['en', 'ar'] as const) test(`Cloud navigation remains clear of Radio in ${locale}`, async ({ page }) => {
  const parsed = parseLocalizationFile(fixture, 'visual-cloud.json')
  if (!parsed.ok) throw new Error(parsed.reason)
  const project = projectFromLocalDocument(parsed.document, 'visual-cloud.json')
  const user = { id: 'visual-user', username: 'visual', email: 'visual@example.invalid', emailVerified: true }
  await page.addInitScript(user => {
    localStorage.setItem('localizationhub.auth.token', 'synthetic-visual-token')
    localStorage.setItem('localizationhub.auth.user', JSON.stringify(user))
  }, user)
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user } }))
  await page.route('**/api/projects/visual-cloud', route => route.fulfill({ json: { project: { id: 'visual-cloud', name: 'Visual Cloud', role: 'owner', revision: 1, project } } }))
  await page.route('**/api/projects/visual-cloud/**', route => route.fulfill({ json: { members: [], assignments: [], entries: [], comments: [], activity: [] } }))
  await populatedRadio(page)
  await page.goto('/app/projects/visual-cloud')
  await page.locator('.lh-language-switcher select').selectOption(locale)
  await expect(page.locator('.source-text')).toContainText('Line 1')
  await expect(page.locator('.lh-radio-capsule-title')).toHaveText('A sufficiently long track title')
  const next = page.locator('.editor-footer').getByRole('button', { name: locale === 'en' ? 'Next Untranslated' : 'النص غير المترجم التالي', exact: true })
  await next.click()
  await expect(page.locator('.source-text')).toContainText('Line 2')
  const box = await next.boundingBox()
  const radio = await page.locator('.lh-radio-capsule').boundingBox()
  expect(box && radio && box.x < radio.x + radio.width && box.x + box.width > radio.x && box.y < radio.y + radio.height && box.y + box.height > radio.y).toBe(false)
})

test('project metadata restores English whitespace and language control clears account actions', async ({ page }) => {
  const user = { id: 'visual-user', username: 'Visual reviewer', email: 'visual@example.invalid', emailVerified: true }
  const projects = [{ id: 'visual-one', name: 'Dialogue review', role: 'owner', revision: 3, sourceFileName: 'synthetic.json', entryCount: 120, translatedCount: 48, memberCount: 2, updatedAt: '2026-08-30T00:00:00Z' }]
  await page.addInitScript(user => { localStorage.setItem('localizationhub.auth.token', 'synthetic-visual'); localStorage.setItem('localizationhub.auth.user', JSON.stringify(user)) }, user)
  await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/auth/me' ? { user } : { projects, tracks: [] } }))
  await page.goto('/app/projects')
  await expect(page.locator('.project-card')).toBeVisible()
  for (const locale of ['ar', 'en', 'ar', 'en']) {
    await page.locator('.lh-language-switcher select').selectOption(locale)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    if (locale === 'en') {
      await expect(page.locator('.project-facts')).toContainText('120 entries')
      await expect(page.locator('.support-actions').getByRole('button', { name: 'Open project', exact: true })).toBeVisible()
      expect(await page.locator('.project-summary, .project-card, .project-support').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringMatching(/[\u0600-\u06ff]/u)]))
    }
    const language = await page.locator('.lh-language-switcher').boundingBox()
    const logout = await page.locator('.account button').boundingBox()
    expect(language).not.toBeNull()
    expect(logout).not.toBeNull()
    // Language lives in the quiet bottom dock; it must not overlap the account header.
    expect(language!.y).toBeGreaterThan(logout!.y + logout!.height)
  }
})
