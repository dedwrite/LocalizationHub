import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { parseLocalizationFile } from '@localizationhub/core'
import { projectFromLocalDocument } from '../../website/src/localProjects'

const source = JSON.stringify([{ entry_id: '1', speaker: 'Caloy', receiver: 'Mark', text_en: 'First {name}', text_ar: '' }, { entry_id: '2', speaker: 'Mark', receiver: 'Caloy', text_en: 'Second {name}', text_ar: '' }])
const text = {
  en: { next: 'Another tip', hide: 'Hide these tips', show: 'Show translation tips', resume: 'Resume saved project', saved: 'Saved to this browser.', save: 'Save locally', back: 'Back to local files', secret: 'A little translator secret', close: 'Close the little secret', end: 'You found the last string.', friday: 'The famous “five-minute” hotfix.', position: 'Saved at entry 2 of 2' },
  ar: { next: 'تلميحة أخرى', hide: 'إخفاء هذه التلميحات', show: 'إظهار تلميحات الترجمة', resume: 'متابعة المشروع المحفوظ', saved: 'حُفظ في هذا المتصفح.', save: 'حفظ محلياً', back: 'العودة إلى الملفات المحلية', secret: 'سر صغير للمترجمين', close: 'إغلاق السر الصغير', end: 'لقيت آخر سطر.', friday: 'الهوتفكس الشهير: «خمس دقايق بس».', position: 'محفوظ عند الإدخال 2 من 2' },
}
async function radio(page: Page, populated = false) {
  await page.route('**/api/radio/**', route => new URL(route.request().url()).pathname === '/api/radio/tracks'
    ? route.fulfill({ json: { tracks: populated ? [{ id: 'synthetic-radio', title: 'Quiet review', artist: 'Synthetic artist', position: 0, durationSeconds: 180, audioUrl: '/api/radio/tracks/synthetic-radio/audio', artworkUrl: null }] : [] } })
    : route.fulfill({ status: 204 }))
}
async function local(page: Page) {
  await radio(page)
  await page.goto('/app/local')
  await page.locator('input[type=file]').setInputFiles({ name: 'delight-synthetic.json', mimeType: 'application/json', buffer: Buffer.from(source) })
  await expect(page.locator('.source-text')).toContainText('First')
}
async function accessible(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).analyze()
  expect(result.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
}

for (const locale of ['en', 'ar'] as const) {
  const labels = text[locale]
  test(`tips change only by request, retain focus and remember hide/show in ${locale}`, async ({ page }) => {
    // This deliberately walks all 16 tips plus locale/storage round trips.
    // Windows WebKit traces show ~2.3s per successful pointer action, so the
    // cumulative scenario needs 60s; individual assertions/retries are unchanged.
    test.setTimeout(60_000)
    await radio(page)
    await page.goto('/')
    await page.locator('.lh-language-switcher select').selectOption(locale)
    const tip = page.locator('.field-tip')
    const before = await tip.locator('p').innerText()
    await page.locator('.lh-language-switcher select').selectOption(locale === 'en' ? 'ar' : 'en')
    await page.locator('.lh-language-switcher select').selectOption(locale)
    await expect(tip.locator('p')).toHaveText(before)
    const seen = new Set([before])
    for (let i = 0; i < 15; i++) {
      const current = await tip.locator('p').innerText()
      await tip.getByRole('button', { name: labels.next, exact: true }).click()
      await expect(tip.locator('p')).not.toHaveText(current)
      const next = await tip.locator('p').innerText()
      expect(seen.has(next)).toBe(false)
      seen.add(next)
    }
    await accessible(page, '.field-notes')
    // Keyboard activation also requires focus to survive the disappearing sibling.
    await tip.getByRole('button', { name: labels.hide, exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(tip.getByRole('button', { name: labels.show, exact: true })).toBeFocused()
    await expect(tip.locator('p')).toHaveCount(0)
    await page.reload()
    await tip.getByRole('button', { name: labels.show, exact: true }).click()
    await expect(tip.locator('p')).toBeVisible()
    await page.reload()
    await expect(tip.locator('p')).toBeVisible()
    if (locale === 'en') expect(await tip.innerText()).not.toMatch(/[\u0600-\u06ff]/u)
  })

  test(`Local resume reopens the saved entry and does not upload in ${locale}`, async ({ page }) => {
    const writes: string[] = []
    page.on('request', request => { if (request.method() === 'POST' || request.method() === 'PUT') writes.push(request.url()) })
    await local(page)
    await page.locator('.translation-editor').fill('Translated {name}')
    await page.locator('.editor-footer').getByRole('button', { name: 'Next', exact: true }).click()
    await page.locator('.lh-language-switcher select').selectOption(locale)
    await page.getByRole('button', { name: labels.save, exact: true }).click()
    await expect(page.locator('.toast')).toContainText(labels.saved)
    await page.getByRole('button', { name: labels.back, exact: true }).click()
    const card = page.locator('.resume-card')
    await expect(card).toContainText('delight-synthetic.json')
    await expect(card).toContainText(labels.position)
    await expect(card.locator('progress')).toHaveAttribute('value', '1')
    await expect(card.locator('progress')).toHaveAttribute('max', '2')
    expect(await page.locator('.local-open-panel').evaluate(panel => {
      const heading = panel.querySelector('h2')!.getBoundingClientRect()
      return [...panel.querySelectorAll('.local-file-graphic i')].every(icon => icon.getBoundingClientRect().bottom <= heading.top)
    })).toBe(true)
    await accessible(page, '.resume-card')
    await card.getByRole('button', { name: labels.resume, exact: true }).click()
    await expect(page.locator('.source-text')).toContainText('Second {name}')
    await expect(page.locator('.dialogue-context-strip')).toContainText('Caloy')
    expect(writes).toEqual([])
  })

  test(`Cloud resume uses current access, handles deletion/failure and keeps locale ${locale}`, async ({ page }) => {
    const parsed = parseLocalizationFile(source, 'resume.json')
    if (!parsed.ok) throw new Error(parsed.reason)
    const project = projectFromLocalDocument(parsed.document, 'resume.json')
    const user = { id: 'delight-user', username: 'Reviewer', email: 'reviewer@example.invalid', emailVerified: true }
    let projects = [
      { id: 'older', name: 'Older project', role: 'viewer', revision: 1, updatedAt: '2026-08-01T00:00:00Z', entryCount: 2, translatedCount: 0 },
      { id: 'newer', name: 'Newer project', role: 'owner', revision: 1, updatedAt: '2026-08-31T00:00:00Z', entryCount: 2, translatedCount: 1 },
    ]
    let failure = false
    await page.addInitScript(user => {
      localStorage.setItem('localizationhub.auth.token', 'synthetic-delight')
      localStorage.setItem('localizationhub.auth.user', JSON.stringify(user))
      localStorage.setItem('localizationhub.recent-cloud.other-user.v1', 'older')
    }, user)
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/me') return route.fulfill({ json: { user } })
      if (path === '/api/projects') return route.fulfill(failure ? { status: 500, json: { error: 'Synthetic failure' } } : { json: { projects } })
      if (path === '/api/projects/older') return route.fulfill({ json: { project: { ...projects[0], project } } })
      return route.fulfill({ json: { tracks: [], members: [], assignments: [], entries: [], comments: [], activity: [] } })
    })
    await page.goto('/app/projects')
    await page.locator('.lh-language-switcher select').selectOption(locale)
    await expect(page.locator('.resume-card')).toContainText('Newer project')
    await page.locator('.project-card').filter({ hasText: 'Older project' }).click()
    await expect(page.locator('.source-text')).toContainText('First')
    await page.goto('/app/projects')
    await expect(page.locator('.resume-card')).toContainText('Older project')
    await expect(page.locator('.resume-kicker')).toHaveText(locale === 'en' ? 'RECENTLY OPENED / THIS ACCOUNT' : 'فُتح مؤخراً / هذا الحساب')
    await page.reload()
    await expect(page.locator('.resume-card')).toContainText('Older project')
    projects = projects.filter(project => project.id !== 'older')
    await page.locator('.heading-actions button').first().click()
    await expect(page.locator('.resume-card')).toContainText('Newer project')
    await expect(page.locator('.resume-kicker')).toHaveText(locale === 'en' ? 'RECENTLY UPDATED / CLOUD' : 'حُدّث مؤخراً / السحابة')
    failure = true
    await page.locator('.heading-actions button').first().click()
    await expect(page.locator('.notice.danger')).toBeVisible()
    await expect(page.locator('.resume-card')).toHaveCount(0)
    failure = false; projects = []
    await page.locator('.heading-actions button').first().click()
    await expect(page.locator('.intentional-empty')).toBeVisible()
    await expect(page.locator('.resume-card')).toHaveCount(0)
  })

  test(`deliberate Easter eggs are keyboard accessible and preserve demo content in ${locale}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await radio(page, true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.locator('.lh-language-switcher select').selectOption(locale)
    const secret = page.getByRole('button', { name: labels.secret, exact: true })
    await expect(page.locator('.lh-radio-capsule-title')).toHaveText('Quiet review')
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })
    // scrollIntoViewIfNeeded does not account for fixed overlays and can place
    // a target directly beneath Radio. Exercise the actual footer resting
    // position after fonts and layout have settled before measuring its dock.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(() => page.evaluate(() => Math.abs(document.documentElement.scrollHeight - (window.scrollY + window.innerHeight)))).toBeLessThanOrEqual(1)
    await expect.poll(async () => secret.evaluate(button => {
      const b = button.getBoundingClientRect(), r = document.querySelector('.lh-radio-capsule')!.getBoundingClientRect()
      return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top
    }), { timeout: 5_000 }).toBe(false)
    await secret.focus()
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
    await expect(page.locator('.secret-note')).toBeHidden()
    await page.keyboard.press('Enter')
    await expect(page.locator('.secret-note')).toContainText(labels.end)
    await expect(page.getByRole('button', { name: labels.close, exact: true })).toBeFocused()
    await accessible(page, '.little-secret')
    await page.keyboard.press('Escape')
    await expect(page.locator('.secret-note')).toBeHidden()
    const content = await page.locator('.demo-copy').allTextContents()
    await page.getByRole('button', { name: 'Friday · 11:59 PM', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Friday · 11:59 PM', exact: true })).toBeFocused()
    await expect(page.locator('.friday-note')).toContainText(labels.friday)
    expect(await page.locator('.demo-copy').allTextContents()).toEqual(content)
    await expect(page.locator('.protected-row code')).toHaveCount(3)
    await accessible(page, '.context-demo')
    await page.keyboard.press('Escape')
    await expect(page.locator('.friday-note')).toBeHidden()
    await page.locator('.faq-locale-secret-trigger').click()
    await expect(page.locator('.faq-locale-secret-note')).toContainText(locale === 'ar' ? 'قاعدة هادئة للتوطين.' : 'A quiet rule of localization.')
    await page.keyboard.press('Escape')
    await expect(page.locator('.faq-locale-secret-note')).toBeHidden()
    expect(errors).toEqual([])
  })
}

test('optional preference storage failures do not break tips or the page', async ({ page }) => {
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem, write = Storage.prototype.setItem
    Storage.prototype.getItem = function(key) { if (key.startsWith('localizationhub.tips.')) throw Error('blocked'); return read.call(this, key) }
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('localizationhub.tips.')) throw Error('full'); return write.call(this, key, value) }
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await radio(page)
  await page.goto('/app/local')
  await expect(page.locator('.resume-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Hide these tips', exact: true }).click()
  await page.getByRole('button', { name: 'Show translation tips', exact: true }).click()
  await page.getByRole('button', { name: 'Another tip', exact: true }).click()
  await expect(page.locator('.field-tip-copy')).toBeVisible()
  await page.locator('.on-device-secret-trigger').click()
  await expect(page.locator('.on-device-secret-note')).toContainText('Still on this device.')
  await page.keyboard.press('Escape')
  await expect(page.locator('.on-device-secret-note')).toBeHidden()
  expect(errors).toEqual([])
})

test('editor tips remain stable across typing and entry changes', async ({ page }) => {
  await local(page)
  const mobile = page.viewportSize()!.width < 768
  if (mobile) await page.locator('.mob-nav button').last().click()
  const inspector = page.locator('.inspector')
  const before = await inspector.locator('.field-tip-copy').innerText()
  if (mobile) await page.locator('.mob-nav button').nth(1).click()
  await page.locator('.translation-editor').fill('Safe {name}')
  await page.locator('.editor-footer').getByRole('button', { name: 'Next', exact: true }).click()
  await page.locator('.editor-footer').getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(page.locator('.translation-editor')).toHaveValue('Safe {name}')
  if (mobile) await page.locator('.mob-nav button').last().click()
  // Desktop Inspector remains mounted while typing. Mobile Tools is explicitly
  // reopened, so a new visit may legitimately choose a new tip.
  if (!mobile) await expect(inspector.locator('.field-tip-copy')).toHaveText(before)
  await inspector.getByRole('tab', { name: 'Quality', exact: true }).click()
  await expect(inspector.locator('.field-tip')).toHaveAttribute('data-tip-context', 'review')
  await accessible(page, '.field-tip')
})
