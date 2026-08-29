import { expect, test, type Page } from '@playwright/test'

/*
 * LH Radio behavior. Spotify's live network is never exercised: the Embed/iFrame
 * API script is stubbed via `page.route`, so these tests verify the shell's
 * behavior (mounting, persistence, laziness, fallback, navigation) deterministically.
 */

function mockSpotify(page: Page) {
  return page.route('**/open.spotify.com/embed/iframe-api/v1', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        (function () {
          var listeners = {};
          var playing = false;
          function emit(name, data) { if (listeners[name]) listeners[name](data); }
          var controller = {
            loadUri: function () {},
            play: function () { (window.__lhCalls = window.__lhCalls || []).push('play'); playing = true; emit('playback_state_changed', { isPaused: false }); },
            pause: function () { (window.__lhCalls = window.__lhCalls || []).push('pause'); playing = false; emit('playback_state_changed', { isPaused: true }); },
            togglePlay: function () { (window.__lhCalls = window.__lhCalls || []).push('togglePlay'); playing = !playing; emit('playback_state_changed', { isPaused: !playing }); },
            destroy: function () {},
            addListener: function (name, cb) { listeners[name] = cb; }
          };
          var api = {
            createController: function (element, options, callback) {
              window.__lhControllerOptions = options;
              callback(controller);
              setTimeout(function () { if (listeners['ready']) listeners['ready']({}); }, 0);
            }
          };
          window.__lhController = controller;
          window.__lhEmit = emit;
          window.onSpotifyIframeApiReady(api);
        })();
      `,
    })
  })
}

async function signIn(page: Page) {
  await page.goto('/app/login')
  await page.evaluate(() => {
    localStorage.setItem('localizationhub.auth.token', 'test-token')
    localStorage.setItem('localizationhub.auth.user', JSON.stringify({ id: 'user-1', username: 'tester', email: 't@example.com', emailVerified: true, createdAt: new Date().toISOString() }))
  })
}

test.describe('LH Radio global player', () => {
  test('renders a single global player on public and app surfaces', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.lh-radio')).toHaveCount(1)
    await expect(page.locator('.lh-radio-capsule')).toBeVisible()

    await page.goto('/app/local')
    await expect(page.locator('.lh-radio')).toHaveCount(1)
    await expect(page.locator('.lh-radio-capsule')).toBeVisible()
  })

  test('stays mounted across internal SPA navigation', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      const el = document.querySelector('.lh-radio') as HTMLElement
      el.dataset.instance = 'same'
    })
    await page.getByRole('link', { name: 'Open Web App' }).click()
    await expect(page).toHaveURL(/\/app/)
    await expect(page.locator('.lh-radio')).toHaveCount(1)
    expect(await page.evaluate(() => (document.querySelector('.lh-radio') as HTMLElement).dataset.instance)).toBe('same')
  })

  test('toggles collapsed and expanded states', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open LH Radio' }).press('Enter')
    await expect(page.locator('.lh-radio-panel')).toBeVisible()
    await page.getByRole('button', { name: 'Collapse LH Radio' }).press('Enter')
    await expect(page.locator('.lh-radio-capsule')).toBeVisible()
  })

  test('does not start playback before a user gesture', async ({ page }) => {
    await mockSpotify(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Open LH Radio' }).press('Enter')
    await page.waitForFunction(() => Boolean((window as any).__lhController))
    expect(await page.evaluate(() => (window as any).__lhCalls ?? [])).toEqual([])

    await page.locator('.lh-radio-panel').getByRole('button', { name: 'Play' }).press('Enter')
    expect(await page.evaluate(() => (window as any).__lhCalls ?? [])).toContain('togglePlay')
  })

  test('falls back gracefully when Spotify is unavailable', async ({ page }) => {
    await page.route('**/open.spotify.com/**', (route) => route.abort())
    await page.goto('/')
    await page.getByRole('button', { name: 'Open LH Radio' }).press('Enter')
    await expect(page.locator('.lh-radio-fallback')).toBeVisible()
    await expect(page.locator('.lh-radio-fallback')).toContainText('Open playlist')
    // The localization app remains fully functional.
    await expect(page.getByRole('heading', { name: /Localization work/ })).toBeVisible()
  })

  test('internal navigation avoids a full document reload', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => { (window as any).__navMarker = 'alive' })
    await page.getByRole('link', { name: 'Open Web App' }).click()
    await expect(page).toHaveURL(/\/app/)
    expect(await page.evaluate(() => (window as any).__navMarker)).toBe('alive')
  })

  test('external links remain external anchors', async ({ page }) => {
    await page.goto('/')
    const github = page.getByRole('link', { name: 'GitHub' }).first()
    await expect(github).toHaveAttribute('href', 'https://github.com/dedwrite/LocalizationHub')
  })
})

test.describe('LH Radio mobile behavior', () => {
  test('capsule clears the app bottom navigation on mobile', async ({ page }) => {
    const viewport = page.viewportSize()
    test.skip(Boolean(viewport && viewport.width >= 768), 'mobile only')

    await page.route('**/api/auth/me', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: 'user-1', username: 'tester', email: 't@example.com', emailVerified: true, createdAt: new Date().toISOString() } }),
    }))
    await page.route('**/api/projects', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ projects: [] }),
    }))
    await signIn(page)
    await page.goto('/app/projects')
    await expect(page.locator('.mobile-nav')).toBeVisible()

    const capsule = await page.locator('.lh-radio-capsule').boundingBox()
    const nav = await page.locator('.mobile-nav').boundingBox()
    expect(capsule).not.toBeNull()
    expect(nav).not.toBeNull()
    expect(capsule!.y + capsule!.height).toBeLessThanOrEqual(nav!.y)
  })
})
