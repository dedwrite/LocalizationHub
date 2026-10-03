import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { isMobileViewport, openEditor, openEntries } from './helpers'

/*
 * The manual accessibility pass, pinned as tests.
 *
 * Rounds of review kept reading the same pages by hand: does every tab stop
 * paint a focus ring, do the tablists answer arrow keys, does the protected
 * symbol check reach a screen reader, do Arabic pages isolate Latin values?
 * These are the checks that can be asserted, so they stop being manual.
 */

const raw = readFileSync('tests/fixtures/caloy-mark.json', 'utf8')
// Focus paint and tablist plumbing are engine-independent; running the walk on
// every viewport would double the suite for no extra signal.
const CHROMIUM = ['desktop', 'phone-390', 'tablet-1024']
const WORKSPACE = ['desktop', 'phone-390']

const publicRoutes = ['/', '/download', '/privacy', '/terms']

async function openLocalProject(page: Page) {
  await page.goto('/app/local')
  await page.locator('input[type="file"]').setInputFiles({ name: 'caloy-mark.json', mimeType: 'text/plain', buffer: Buffer.from(raw) })
  await expect(page.locator('.source-text')).toBeVisible()
}

/**
 * Walk the real tab order and report every stop whose focus paint is identical
 * to its resting paint. The element is blurred for one frame to read the
 * resting state, then focused again so Tab continues from the same place.
 */
async function focusIndicatorFailures(page: Page, limit: number) {
  const failures: string[] = []
  await page.evaluate(() => window.scrollTo(0, 0))
  for (let index = 0; index < limit; index++) {
    await page.keyboard.press('Tab')
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      if (!element || element === document.body) return null
      const paint = (node: HTMLElement) => {
        const style = getComputedStyle(node)
        return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.boxShadow, style.borderTopColor, style.borderBottomColor, style.backgroundColor, style.color, style.textDecorationLine, style.animationName].join('|')
      }
      const focused = paint(element)
      element.blur()
      const resting = paint(element)
      element.focus()
      const rect = element.getBoundingClientRect()
      return {
        focused, resting,
        tag: element.tagName.toLowerCase(),
        name: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        where: `${Math.round(rect.x)},${Math.round(rect.y)}`,
      }
    })
    if (!stop) break
    if (stop.focused === stop.resting) failures.push(`<${stop.tag}> "${stop.name}" at ${stop.where}`)
  }
  return failures
}

for (const route of publicRoutes) {
  test(`${route} paints a focus indicator on every tab stop`, async ({ page }, testInfo) => {
    test.skip(!CHROMIUM.includes(testInfo.project.name), 'focus paint is engine-independent; the walk runs on Chromium')
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    let failures = await focusIndicatorFailures(page, 45)
    // One reload covers a decoration that happened to be mid-transition.
    if (failures.length > 0) {
      await page.reload()
      failures = await focusIndicatorFailures(page, 45)
    }
    expect(failures).toEqual([])
  })
}

for (const route of ['/', '/download']) {
  test(`${route} images are described or decorative beside their own label`, async ({ page }) => {
    await page.goto(route)
    const offenders = await page.$$eval('img', (images) => images.map((image) => {
      const source = image.getAttribute('src') ?? ''
      const alt = image.getAttribute('alt')
      if (alt === null) return `missing alt (${source})`
      if (alt.trim() === '') {
        // An empty alt is the decorative signal: allowed unless the image is
        // the only name an interactive control has.
        const control = image.closest('a, button, [role="button"]')
        if (!control) return null
        const label = (control.getAttribute('aria-label') || control.textContent || '').trim()
        return label.length > 0 ? null : `decorative mark is the only label of a control (${source})`
      }
      // A described image has to actually describe something.
      return alt.trim().length >= 8 ? null : `terse alt "${alt}" (${source})`
    }).filter((entry): entry is string => Boolean(entry)))
    expect(offenders).toEqual([])
  })
}

test('entry filters answer arrow keys, Home and End in both directions', async ({ page }, testInfo) => {
  test.skip(!WORKSPACE.includes(testInfo.project.name), 'the filter tablist is covered on desktop and phone')
  await openLocalProject(page)
  await openEntries(page)
  const list = page.locator(isMobileViewport(page) ? '.mob-filters' : '.entries-filters')
  const tabs = list.locator('[role="tab"]')
  const selectedIndex = async () => tabs.evaluateAll((nodes) => nodes.findIndex((node) => node.getAttribute('aria-selected') === 'true'))

  // English: the arrows follow the reading order.
  await tabs.first().click()
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowRight')
  expect(await selectedIndex()).toBe(1)
  expect(await tabs.nth(1).evaluate((node) => node === document.activeElement)).toBe(true)
  await page.keyboard.press('End')
  expect(await selectedIndex()).toBe((await tabs.count()) - 1)
  await page.keyboard.press('Home')
  expect(await selectedIndex()).toBe(0)
  // Roving tabindex: exactly one tab stays in the document tab order.
  await expect(list.locator('[role="tab"][tabindex="0"]')).toHaveCount(1)
  await expect(list.locator('[role="tab"]')).toHaveCount(await tabs.count())
  await expect(list.locator('[role="tab"]').first()).toHaveAttribute('aria-controls', 'entries-tabpanel')

  // Arabic: the same keys follow the visual direction instead.
  await page.locator('.lh-language-switcher select').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const last = (await tabs.count()) - 1
  await tabs.first().click()
  await page.keyboard.press('ArrowRight')
  expect(await selectedIndex()).toBe(last)
  await page.keyboard.press('ArrowLeft')
  expect(await selectedIndex()).toBe(0)
})

test('inspector tabs follow the tab pattern', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the inspector pane is the desktop layout')
  await openLocalProject(page)
  const panel = page.locator('#inspector-tabpanel')
  const workflow = page.getByRole('tab', { name: 'Workflow', exact: true })
  await workflow.click()
  await expect(workflow).toHaveAttribute('aria-controls', 'inspector-tabpanel')
  await expect(panel).toBeVisible()
  await expect(panel).toHaveAttribute('aria-labelledby', 'inspector-tab-workflow')
  // Confirm the tab really holds focus before the arrow: the workspace may still
  // be settling, and a replaced node would swallow the key.
  await workflow.focus()
  await expect(workflow).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const quality = page.getByRole('tab', { name: 'Quality', exact: true })
  await expect(quality).toHaveAttribute('aria-selected', 'true')
  await expect(quality).toBeFocused()
  await expect(panel).toHaveAttribute('aria-labelledby', 'inspector-tab-quality')
  await expect(panel.getByRole('heading', { name: 'Quality' })).toBeVisible()
})

test('the protected-symbol check reaches a screen reader, including the clear state', async ({ page }, testInfo) => {
  test.skip(!WORKSPACE.includes(testInfo.project.name), 'the editor is covered on desktop and phone')
  await openLocalProject(page)
  const status = page.locator('#translation-check')
  await expect(status).toHaveAttribute('role', 'status')
  // An unstarted entry is not a broken translation: nothing is announced.
  await expect(status).toHaveText('')
  await page.locator('.translation-editor').fill('Draft without protected tokens')
  await expect(status).toHaveText(/protected token/i)
  await expect(page.locator('.inline-qa-item').first()).toBeVisible()
  await page.locator('.translation-editor').fill('[shake rate=32 level=8]مرحبا![/shake]')
  await expect(status).toHaveText(/check is clear/i)
  await expect(page.locator('.inline-qa-item')).toHaveCount(0)
  await page.locator('.translation-editor').fill('')
  await expect(status).toHaveText('')
  // Arabic readers hear the Arabic sentence, not the English one.
  await page.locator('.lh-language-switcher select').selectOption('ar')
  await page.locator('.translation-editor').fill('مسودة بلا رموز')
  await expect(status).toHaveText(/أعد الرمز المحمي المفقود/)
})

test('workspace values stay isolated from the reading direction', async ({ page }, testInfo) => {
  test.skip(!WORKSPACE.includes(testInfo.project.name), 'the workspace is covered on desktop and phone')
  await openLocalProject(page)
  await openEditor(page)
  const title = isMobileViewport(page) ? page.locator('.mob-project-name') : page.locator('.toolbar-title')
  await expect(title.locator('bdi')).toHaveCount(1)
  // A translated row is the one that can carry arbitrary text.
  await page.locator('.translation-editor').fill('مرحبا بالعالم')
  await openEntries(page)
  await expect(page.locator('.entry-preview[dir="auto"]').first()).toBeVisible()

  await page.locator('.lh-language-switcher select').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  // Technical keys are Latin while the page reads right-to-left.
  const key = page.locator('.entry-key bdi').first()
  await expect(key).toBeVisible()
  await expect(key).toHaveCSS('direction', 'ltr')
  // Preview text decides its own direction from its first strong character
  // (the "untranslated" placeholder is interface copy and keeps the page direction).
  await expect(page.locator('.entry-preview[dir="auto"]').first()).toHaveCSS('direction', 'rtl')
})
