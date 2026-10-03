import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/*
 * The reference pages exist so a claim can be checked. These tests keep them
 * reachable and honest: prerendered (a crawler and a first paint see the text),
 * one reading column, no serious accessibility violations, machine values
 * isolated inside Arabic, and the hub listing every page.
 */

const ROUTES = ['/reference', '/godot', '/unreal', '/unity', '/formats/json', '/formats/po', '/features/translation-memory'] as const
const CHROMIUM = ['desktop', 'phone-390', 'tablet-1024']

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

for (const route of ROUTES) {
  test(`${route} is a prerendered reference page`, async ({ page }, testInfo) => {
    test.skip(!CHROMIUM.includes(testInfo.project.name), 'markup and metadata are engine-independent')
    const response = await page.goto(route)
    expect(response?.status()).toBe(200)
    // Prerendering writes the real React tree into the served HTML: the page is
    // readable before any JavaScript runs, which is also what a crawler sees.
    const html = await (await fetch(`${testInfo.project.use.baseURL}${route}`)).text()
    const root = html.match(/<div id="root"[^>]*>/)?.[0] ?? ''
    expect(root).toContain('data-prerendered')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page).toHaveTitle(/LocalizationHub/)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await expect(page.locator('.capability-note')).toBeVisible()
  })
}

test('the reference pages pass an accessibility audit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the audit is desktop-only; every other project reads the same markup')
  for (const route of ROUTES) {
    await page.goto(route)
    await page.locator('h1').waitFor()
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
    expect(serious.map((violation) => `${route}: ${violation.id}`)).toEqual([])
  }
})

test('the hub lists every page and every page links back', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'link routing is covered on desktop')
  await page.goto('/reference')
  for (const route of ROUTES.slice(1)) await expect(page.locator(`.capability-index a[href="${route}"]`)).toHaveCount(1)
  for (const route of ROUTES.slice(1)) {
    await page.goto(route)
    await expect(page.locator('.capability-related a[href="/reference"]')).toHaveCount(1)
    // The hub link plus every sibling page, and never the page itself.
    await expect(page.locator('.capability-related a')).toHaveCount(ROUTES.length - 1)
  }
})

test('Arabic reference pages isolate machine values and leave no English heading', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'direction and locale switching are covered on desktop')
  await page.goto('/godot')
  await page.locator('.lh-language-switcher select').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('h1')).toHaveText('غودوت كما يُشحن')
  const keyword = page.locator('.capability-group code', { hasText: 'tr()' }).first()
  await expect(keyword).toBeVisible()
  await expect(keyword).toHaveCSS('unicode-bidi', 'isolate')
  await expect(keyword).toHaveCSS('direction', 'ltr')
})

test('the sitemap and the footer carry the reference pages', async ({ page }) => {
  const sitemap = await (await fetch('http://127.0.0.1:8787/sitemap.xml')).text()
  for (const route of ROUTES) expect(sitemap).toContain(`https://localizationhub.app${route}`)
  await page.goto('/godot')
  await expect(page.locator('footer a[href="/reference"]')).toHaveCount(1)
})
