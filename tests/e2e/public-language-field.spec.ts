import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio/**', route => route.fulfill({ json: { tracks: [] } }))
})

for (const locale of ['en', 'ar']) {
  test(`connected hero and narrow header hold their composition in ${locale}`, async ({ page }) => {
    await page.addInitScript(locale => localStorage.setItem('localizationhub.ui-locale.v1', locale), locale)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const intro = (await page.locator('.hero-intro').boundingBox())!
    const proof = (await page.locator('.hero-visual').boundingBox())!
    expect(Math.abs(intro.y - proof.y)).toBeLessThan(120)
    expect((await page.locator('.live-preview textarea').boundingBox())!.y + (await page.locator('.live-preview textarea').boundingBox())!.height).toBeLessThan(900)
    expect((await page.locator('.hero .button-primary').boundingBox())!.y).toBeLessThan(700)
    await page.setViewportSize({ width: 320, height: 800 })
    const header = page.locator('#public-site .site-header')
    expect(await header.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await expect(page.locator('.lh-language-switcher select')).toHaveCSS('font-size', '16px')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  })

  test(`landing controls and long translations remain usable in ${locale}`, async ({ page }) => {
    await page.addInitScript(locale => localStorage.setItem('localizationhub.ui-locale.v1', locale), locale)
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    for (const selector of ['.preview-reset', '.preview-entry', '.lh-language-switcher select', '.mobile-site-menu summary', '.site-command-launcher', '.rtl-game-rune']) {
      for (const control of await page.locator(`#public-site ${selector}`).all()) {
        if (await control.isVisible()) {
          expect((await control.boundingBox())!.height, selector).toBeGreaterThanOrEqual(44)
        }
      }
    }
    for (const selector of ['.hero-description', '.section-intro > p:last-child', '.feature p', '.surface p', '.privacy-brief p']) {
      expect(await page.locator(`#public-site ${selector}`).evaluateAll(nodes => nodes.every(node => parseFloat(getComputedStyle(node).fontSize) >= 16)), selector).toBe(true)
    }
    const input = page.locator('.live-preview textarea')
    await expect(input).toHaveAttribute('name', 'sample-translation')
    await expect(input).toHaveAttribute('autocomplete', 'off')
    await input.fill('')
    await expect(page.locator('.preview-check')).toHaveClass(/is-empty/)
    // A deliberately unbroken Arabic string exercises the narrowest layout.
    const longTranslation = 'ع'.repeat(1987) + '{player_name}'
    await input.fill(longTranslation)
    await expect(input).toHaveValue(longTranslation)
    await expect(page.locator('.preview-check')).toHaveClass(/is-valid/)
    await expect(input).toHaveCSS('direction', 'rtl')
    await input.press('End')
    await input.press('x')
    expect((await input.inputValue()).length).toBe(2000)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
    await page.locator('.preview-reset').click()
    await expect(input).toHaveValue('اثبت يا {player_name}.')
    await expect(page.locator('.preview-token-guide code').first()).toHaveAttribute('translate', 'no')
    // Keyboard focus on the native language control must remain visible.
    await page.locator('.mobile-site-menu summary').isVisible().then(async visible => {
      if (visible) {
        await page.locator('.mobile-site-menu summary').focus()
        await page.keyboard.press('Tab')
        await expect(page.locator('.lh-language-switcher select')).toBeFocused()
        await expect(page.locator('.lh-language-switcher select')).toHaveCSS('outline-style', 'solid')
      }
    })
  })

  test(`picture-free landing is readable and interactive in ${locale}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(locale => localStorage.setItem('localizationhub.ui-locale.v1', locale), locale)
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page.locator('.language-glyph')).toHaveCount(40)
    await expect(page.locator('.language-field')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('.language-field')).toHaveCSS('pointer-events', 'none')
    expect(await page.locator('.language-field').evaluate(node => {
      const style = getComputedStyle(node)
      return style.getPropertyValue('user-select') || style.getPropertyValue('-webkit-user-select')
    })).toBe('none')
    expect(await page.locator('#public-site main img').count()).toBe(0)
    await expect(page.locator('.hero h1 i')).toHaveCount(0)
    await expect(page.locator('.hero a[href="/app/local"]')).toBeVisible()
    await page.locator('.live-preview textarea').fill('نص بلا رمز')
    await expect(page.locator('.preview-check')).toHaveClass(/is-error/)
    await page.locator('.preview-reset').click()
    await expect(page.locator('.preview-check')).toHaveClass(/is-valid/)
    await expect(page.locator('.live-preview textarea')).toHaveValue('اثبت يا {player_name}.')
    await page.locator('.preview-entry').nth(2).click()
    await expect(page.locator('.preview-source p')).toContainText('<b>Northern Gate</b>')
    await page.locator('.preview-entry').first().click()
    await page.locator('#context').scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
    const audit = await new AxeBuilder({ page }).include('#public-site').analyze()
    expect(audit.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([])
    expect(errors).toEqual([])
  })
}

test('landing font preloads do not leak into the application shell', async ({ request }) => {
  const landing = await (await request.get('/')).text()
  const app = await (await request.get('/app/local')).text()
  expect(landing).toContain('name="theme-color" content="#111016"')
  expect(landing).toContain('rel="preload" href="/fonts/schibsted-grotesk-latin.woff2"')
  expect(landing).toContain('rel="preload" href="/fonts/noto-sans-arabic.woff2"')
  expect(app).not.toContain('rel="preload" href="/fonts/')
})

test('decoration stays static with reduced motion and is absent from the Web App', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.language-glyph').first()).toHaveCSS('animation-name', 'none')
  const geometry = await page.locator('.language-glyph').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).style.cssText))
  await page.locator('.lh-language-switcher select').selectOption('ar')
  expect(await page.locator('.language-glyph').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).style.cssText))).toEqual(geometry)
  await page.goto('/app/local')
  await expect(page.locator('#public-site, .language-field')).toHaveCount(0)
  await expect(page.locator('input[type=file]')).toBeAttached()
})

test('forced colors hide nonessential characters', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not support forced-color emulation')
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/')
  await expect(page.locator('.language-field')).toHaveCSS('display', 'none')
  await expect(page.locator('.hero a[href="/app/local"]')).toBeVisible()
})
