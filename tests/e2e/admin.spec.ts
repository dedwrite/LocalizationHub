import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const metrics = {
  total_users: 12,
  verified_users: 9,
  unverified_users: 3,
  suspended_users: 1,
  total_projects: 5,
  total_memberships: 18,
  active_sessions: 4,
  logical_storage: 1048576,
}

const dashboard = {
  user: { id: 'admin-1', username: 'operator' },
  metrics,
  recentActivity: [
    { id: 'log-1', admin_user_id: 'admin-1', admin_username: 'operator', action: 'admin.user.suspend', target_type: 'user', target_id: 'u2', success: true, metadata: null, created_at: '2026-08-26T10:00:00Z' },
  ],
}

const users = {
  users: [
    { id: 'u1', username: 'alice', email: 'alice@example.com', site_role: 'user', email_verified_at: '2026-08-26T09:00:00Z', suspended_at: null, created_at: '2026-08-20T09:00:00Z', session_count: 2 },
    { id: 'u2', username: 'bob', email: 'bob@example.com', site_role: 'user', email_verified_at: null, suspended_at: '2026-08-25T09:00:00Z', created_at: '2026-08-21T09:00:00Z', session_count: 0 },
  ],
  total: 2,
}

const userDetail = {
  id: 'u1', username: 'alice', email: 'alice@example.com', site_role: 'user', email_verified_at: '2026-08-26T09:00:00Z', suspended_at: null, created_at: '2026-08-20T09:00:00Z', session_count: 1, owned_projects: 1, shared_projects: 2, logical_storage: 2048,
}

const projects = {
  projects: [
    { id: 'p1', name: 'RPG Localization', owner_username: 'alice', created_at: '2026-08-22T09:00:00Z', updated_at: '2026-08-26T09:00:00Z', member_count: 3, entry_count: 48, logical_size: 4096 },
  ],
  total: 1,
}

const projectDetail = {
  id: 'p1', name: 'RPG Localization', owner_id: 'u1', owner_username: 'alice', created_at: '2026-08-22T09:00:00Z', updated_at: '2026-08-26T09:00:00Z', member_count: 2, entry_count: 48, logical_size: 4096,
  members: [
    { id: 'u2', username: 'bob', role: 'editor' },
    { id: 'u3', username: 'carol', role: 'viewer' },
  ],
}

const sessions = { sessions: [{ token_hash: 'a1b2c3d4e5f6', expires_at: '2026-08-27T09:00:00Z', created_at: '2026-08-26T09:00:00Z' }] }
const storage = { owned_storage: 2048, owned_projects: [{ projectId: 'p1', projectName: 'RPG Localization', bytes: 2048 }] }
const audit = { logs: [{ id: 'log-1', admin_user_id: 'admin-1', admin_username: 'operator', action: 'admin.user.suspend', target_type: 'user', target_id: 'u2', success: true, metadata: null, created_at: '2026-08-26T10:00:00Z' }], total: 1 }

async function mockAdminApi(page: Page) {
  await page.route('**/api/admin**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api\/admin\/?/, '')
    const method = route.request().method()
    if (method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      return
    }
    let body: unknown = {}
    if (path === '') body = dashboard
    else if (path === 'auth') body = {}
    else if (path.startsWith('users/')) body = userDetail
    else if (path.startsWith('users')) body = users
    else if (path.startsWith('projects/')) body = projectDetail
    else if (path.startsWith('projects')) body = projects
    else if (path.startsWith('sessions')) body = sessions
    else if (path.startsWith('storage')) body = storage
    else if (path.startsWith('audit')) body = audit
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

async function authenticate(page: Page) {
  await page.goto('/app/admin/security')
  await page.evaluate(() => {
    window.localStorage.setItem('localizationhub.auth.token', 'test-normal-token')
    window.sessionStorage.setItem('localizationhub.admin.session', 'test-admin-token')
  })
}

// A signed-in (normal session) but NOT yet elevated browser.
async function signInOnly(page: Page) {
  await page.goto('/app/admin/security')
  await page.evaluate(() => {
    window.localStorage.setItem('localizationhub.auth.token', 'test-normal-token')
  })
}

test.describe('admin console routing and views', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page)
    await authenticate(page)
  })

  test('shows the Sign in prompt when there is no normal session', async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.removeItem('localizationhub.auth.token')
      window.sessionStorage.removeItem('localizationhub.admin.session')
    })
    await page.goto('/app/admin')
    await expect(page.getByRole('heading', { name: 'Admin Access' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Request email code' })).toHaveCount(0)
  })

  test('shows the MFA gate when signed in but not elevated', async ({ page }) => {
    await page.evaluate(() => window.sessionStorage.removeItem('localizationhub.admin.session'))
    await page.goto('/app/admin')
    await expect(page.getByRole('heading', { name: 'Admin Access' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Request email code' })).toBeVisible()
  })

  test('renders the dashboard with platform metrics', async ({ page }) => {
    await page.goto('/app/admin')
    await expect(page.getByText('Platform metrics')).toBeVisible()
    await expect(page.getByText('Total users')).toBeVisible()
    await expect(page.getByText('Recent activity')).toBeVisible()
  })

  test('navigates to users, opens detail, and lists sessions', async ({ page }) => {
    await page.goto('/app/admin/users')
    await expect(page.getByRole('cell', { name: 'alice', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'View' }).first().click()
    await expect(page).toHaveURL(/\/app\/admin\/users\/u1$/)
    await expect(page.getByText('alice@example.com')).toBeVisible()
    await expect(page.getByText('RPG Localization')).toBeVisible()
  })

  test('navigates to projects and opens detail with members', async ({ page }) => {
    await page.goto('/app/admin/projects')
    await expect(page.getByText('RPG Localization')).toBeVisible()
    await page.getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(/\/app\/admin\/projects\/p1$/)
    await expect(page.getByRole('cell', { name: 'bob', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'carol', exact: true })).toBeVisible()
  })

  test('renders the audit log', async ({ page }) => {
    await page.goto('/app/admin/audit')
    await expect(page.getByText('Audit log')).toBeVisible()
    await expect(page.getByText('admin.user.suspend')).toBeVisible()
  })

  test('opens a destructive confirmation dialog', async ({ page }) => {
    await page.goto('/app/admin/users/u1')
    await page.getByRole('button', { name: 'Delete user' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Permanently delete alice?')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('admin accessibility and viewports', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page)
    await authenticate(page)
  })

  test('has no serious or critical accessibility violations', async ({ page }) => {
    for (const path of ['/app/admin', '/app/admin/users', '/app/admin/projects', '/app/admin/audit', '/app/admin/users/u1']) {
      await page.goto(path)
      const results = await new AxeBuilder({ page }).analyze()
      const serious = results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
      expect(serious, `axe violations on ${path}`).toEqual([])
    }
  })

  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    test(`renders the dashboard at ${width}px without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 500 ? 800 : 900 })
      await page.goto('/app/admin')
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(width)
      await expect(page.getByText('Total users')).toBeVisible()
    })
  }
})

test.describe('admin API authentication headers', () => {
  test('sends the normal Authorization header when requesting the email OTP before elevation', async ({ page }) => {
    const captured: { url: string; headers: Record<string, string> }[] = []
    await page.route('**/api/admin**', async (route) => {
      captured.push({ url: route.request().url(), headers: route.request().headers() })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })
    await signInOnly(page)
    await page.goto('/app/admin')
    await page.getByRole('button', { name: 'Request email code' }).click()
    const request = captured.find((c) => c.url.includes('/api/admin/auth/email/request'))
    expect(request).toBeTruthy()
    expect(request!.headers['authorization']).toBe('Bearer test-normal-token')
    expect(request!.headers['x-admin-session']).toBeUndefined()
  })

  test('sends both Authorization and X-Admin-Session on elevated calls', async ({ page }) => {
    const captured: { url: string; headers: Record<string, string> }[] = []
    await page.route('**/api/admin**', async (route) => {
      captured.push({ url: route.request().url(), headers: route.request().headers() })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboard) })
    })
    await authenticate(page)
    await page.goto('/app/admin')
    await expect(page.getByText('Platform metrics')).toBeVisible()
    const request = captured.find((c) => c.url.replace(/\/+$/, '').endsWith('/api/admin'))
    expect(request).toBeTruthy()
    expect(request!.headers['authorization']).toBe('Bearer test-normal-token')
    expect(request!.headers['x-admin-session']).toBe('test-admin-token')
  })
})
