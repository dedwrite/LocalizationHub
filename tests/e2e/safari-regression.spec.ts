import { expect, test } from '@playwright/test'

/*
 * Regression coverage for the production crash that shipped to real iPhone
 * Safari: visiting /app with no valid auth rendered "Workspace unavailable"
 * instead of Login. The root cause was rendering a protected view with a null
 * user during the render that follows session restoration (before the redirect
 * effect ran), plus a fragile `getStoredUser()` that `JSON.parse`d raw storage.
 *
 * These assertions must pass on real WebKit (iPhone/iPad projects) — Chromium
 * viewport emulation is NOT a Safari substitute.
 */

const USER_KEY = 'localizationhub.auth.user'
const TOKEN_KEY = 'localizationhub.auth.token'

function collectPageErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function expectLogin(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await expect(page.getByText('Workspace unavailable.')).toHaveCount(0)
}

test.describe('Safari / WebKit app boot regression', () => {
  test('clean context reaches Login with zero page errors', async ({ page }) => {
    const pageErrors = collectPageErrors(page)
    await page.goto('/app')
    await expectLogin(page)
    expect(pageErrors).toEqual([])
  })

  test('corrupt stored user JSON recovers to Login with zero page errors', async ({ page }) => {
    const pageErrors = collectPageErrors(page)
    await page.addInitScript((key) => {
      localStorage.setItem(key, '{this is not valid json')
    }, USER_KEY)
    await page.goto('/app')
    await expectLogin(page)
    expect(pageErrors).toEqual([])
  })

  test('non-object stored user is discarded and reaches Login', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, '"just-a-string"')
    }, USER_KEY)
    await page.goto('/app')
    await expectLogin(page)
  })

  test('stale/expired token recovers to Login without Workspace unavailable', async ({ page }) => {
    await page.addInitScript(([userKey, tokenKey]) => {
      localStorage.setItem(userKey, JSON.stringify({ id: 'u1', username: 'ghost', email: 'ghost@example.com', emailVerified: true, createdAt: '2020-01-01' }))
      localStorage.setItem(tokenKey, 'expired-token-value')
    }, [USER_KEY, TOKEN_KEY] as const)
    await page.goto('/app')
    await expectLogin(page)
  })

  test('deep-linked app routes render without the error boundary at iPhone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const path of ['/app', '/app/login', '/app/register', '/app/local', '/app/projects']) {
      await page.goto(path)
      await expect(page.locator('body')).toBeVisible()
      await expect(page.getByText('Workspace unavailable.')).toHaveCount(0)
    }
  })

  test('no horizontal overflow at iPhone viewport widths', async ({ page }) => {
    for (const [width, height] of [[390, 844], [430, 932]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/app/login')
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(width)
    }
  })
})
