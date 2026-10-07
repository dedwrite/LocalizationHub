import { expect, test, type Page } from '@playwright/test'

/*
 * Native LH Radio behavior. The radio API is stubbed via `page.route` so tests
 * never depend on a live database. Playback is driven by stubbing the audio
 * element's play/pause to fire synthetic events, keeping assertions deterministic.
 */

const tracks = [
  { id: '11111111-1111-4111-8111-111111111111', title: 'First Light', artist: 'Aurora Field', album: 'Dawn', position: 0, durationSeconds: 180, artworkUrl: '/api/radio/tracks/11111111-1111-4111-8111-111111111111/artwork', audioUrl: '/api/radio/tracks/11111111-1111-4111-8111-111111111111/audio' },
  { id: '22222222-2222-4222-8222-222222222222', title: 'Second Bloom', artist: 'Mica', album: 'Dawn', position: 1, durationSeconds: 240, artworkUrl: '/api/radio/tracks/22222222-2222-4222-8222-222222222222/artwork', audioUrl: '/api/radio/tracks/22222222-2222-4222-8222-222222222222/audio' },
  { id: '33333333-3333-4333-8333-333333333333', title: 'Third Orbit', artist: 'Orbital', album: null, position: 2, durationSeconds: 210, artworkUrl: '/api/radio/tracks/33333333-3333-4333-8333-333333333333/artwork', audioUrl: '/api/radio/tracks/33333333-3333-4333-8333-333333333333/audio' },
]

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

async function mockRadio(page: Page, catalog = tracks) {
  await page.route('**/api/radio**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/radio/tracks') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tracks: catalog }) })
      return
    }
    if (url.pathname.endsWith('/artwork')) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX })
      return
    }
    if (url.pathname.endsWith('/audio')) {
      await route.fulfill({ status: 200, contentType: 'audio/mpeg', headers: { 'Accept-Ranges': 'bytes', 'Content-Length': '1024' }, body: Buffer.alloc(1024, 0) })
      return
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not-found' }) })
  })
}

async function stubPlayback(page: Page) {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      queueMicrotask(() => this.dispatchEvent(new Event('play')))
      return Promise.resolve()
    }
    HTMLMediaElement.prototype.pause = function () {
      queueMicrotask(() => this.dispatchEvent(new Event('pause')))
    }
  })
}

test.describe('LH Radio native player', () => {
  test('renders a single global player and loads the catalog', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await expect(page.locator('.lh-radio')).toHaveCount(1)
    await expect(page.locator('.lh-radio-capsule')).toBeVisible()
    await expect(page.locator('.lh-radio-capsule-title')).toHaveText('First Light')
  })

  test('does not autoplay before user interaction', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await expect(page.locator('.lh-radio.is-playing')).toHaveCount(0)
  })

  test('stays mounted across internal SPA navigation', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await expect(page.locator('.lh-radio-capsule')).toBeVisible()
    await page.evaluate(() => {
      const el = document.querySelector('.lh-radio') as HTMLElement
      el.dataset.instance = 'same'
    })
    await page.locator('a[href="/app/local"]').first().click()
    await expect(page).toHaveURL(/\/app/)
    await expect(page.locator('.lh-radio')).toHaveCount(1)
    expect(await page.evaluate(() => (document.querySelector('.lh-radio') as HTMLElement).dataset.instance)).toBe('same')
  })

  test('toggles play/pause and updates the control label', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await expect(page.locator('.lh-radio-capsule-title')).toHaveText('First Light')
    await page.getByRole('button', { name: 'Play', exact: true }).press('Enter')
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    await expect(page.locator('.lh-radio.is-playing')).toHaveCount(1)
    await page.getByRole('button', { name: 'Pause', exact: true }).press('Enter')
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  })

  test('next and previous navigate the catalog order', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await expect(page.locator('.lh-radio-capsule-title')).toHaveText('First Light')
    await page.getByRole('button', { name: 'Next track' }).press('Enter')
    await expect(page.locator('.lh-radio-capsule-title')).toHaveText('Second Bloom')
    await page.getByRole('button', { name: 'Next track' }).press('Enter')
    await expect(page.locator('.lh-radio-capsule-title')).toHaveText('Third Orbit')
    await page.getByRole('button', { name: 'Previous track' }).press('Enter')
    await expect(page.locator('.lh-radio-capsule-title')).toHaveText('Second Bloom')
  })

  test('expanded panel exposes seek, volume, and playlist', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Open LH Radio' }).press('Enter')
    await expect(page.locator('.lh-radio-panel')).toBeVisible()
    await expect(page.getByLabel('Seek')).toBeVisible()
    await expect(page.getByLabel('Volume')).toBeVisible()
    await expect(page.getByLabel('Mute')).toBeVisible()
    await expect(page.locator('.lh-radio-playlist-item')).toHaveCount(3)
  })

  test('selecting a track from the playlist plays it', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Open LH Radio' }).press('Enter')
    await page.locator('.lh-radio-playlist-item').nth(2).press('Enter')
    await expect(page.locator('.lh-radio-now-title')).toHaveText('Third Orbit')
  })

  test('mute toggles and volume persists to localStorage', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Open LH Radio' }).press('Enter')
    await page.getByLabel('Volume').fill('0.3')
    await page.getByRole('button', { name: 'Mute' }).click()
    await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('localizationhub.web.lhRadio.volume'))).toBe('0.3')
    expect(await page.evaluate(() => localStorage.getItem('localizationhub.web.lhRadio.muted'))).toBe('1')
  })

  test('hides cleanly when no tracks are published', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page, [])
    await page.goto('/')
    await expect(page.locator('.lh-radio-capsule')).toHaveCount(0)
  })

  test('collapse control returns to the capsule', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Open LH Radio' }).press('Enter')
    await page.getByRole('button', { name: 'Collapse LH Radio' }).click()
    await expect(page.locator('.lh-radio-capsule')).toBeVisible()
  })

  test('the cover disc spins only while playing', async ({ page }) => {
    await stubPlayback(page)
    await mockRadio(page)
    await page.goto('/')
    await expect(page.locator('.lh-radio-capsule .lh-radio-disc')).toBeVisible()
    await expect(page.locator('.lh-radio-capsule-title')).toHaveText('First Light')
    const disc = page.locator('.lh-radio-capsule .lh-radio-disc')
    await expect(disc).toHaveCSS('animation-play-state', 'paused')
    await page.getByRole('button', { name: 'Play', exact: true }).press('Enter')
    await expect(page.locator('.lh-radio.is-playing')).toHaveCount(1)
    await expect(disc).toHaveCSS('animation-play-state', 'running')
  })
})

test.describe('LH Radio mobile behavior', () => {
  test('capsule clears the app bottom navigation on mobile', async ({ page }) => {
    const viewport = page.viewportSize()
    test.skip(Boolean(viewport && viewport.width >= 768), 'mobile only')

    await stubPlayback(page)
    await mockRadio(page)
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
    await page.goto('/app/login')
    await page.evaluate(() => {
      localStorage.setItem('localizationhub.auth.token', 'test-token')
      localStorage.setItem('localizationhub.auth.user', JSON.stringify({ id: 'user-1', username: 'tester', email: 't@example.com', emailVerified: true, createdAt: new Date().toISOString() }))
    })
    await page.goto('/app/projects')
    await expect(page.locator('.mobile-nav')).toBeVisible()

    const capsule = await page.locator('.lh-radio-capsule').boundingBox()
    const nav = await page.locator('.mobile-nav').boundingBox()
    expect(capsule).not.toBeNull()
    expect(nav).not.toBeNull()
    expect(capsule!.y + capsule!.height).toBeLessThanOrEqual(nav!.y)
  })
})
