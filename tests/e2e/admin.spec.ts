import { expect, test, type Page, type Route } from '@playwright/test'
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

// A fake (non-production) enrollment payload used only in tests.
const enrollment = {
  secret: 'JBSWY3DPEHPK3PXP',
  uri: 'otpauth://totp/LocalizationHub:operator?secret=JBSWY3DPEHPK3PXP&issuer=LocalizationHub&algorithm=SHA1&digits=6&period=30',
}

const radioTracks = {
  tracks: [
    { id: '11111111-1111-4111-8111-111111111111', title: 'First Light', artist: 'Aurora Field', album: 'Dawn', position: 0, published: true, audioMime: 'audio/mpeg', audioSizeBytes: 12345, artworkMime: 'image/png', artworkSizeBytes: 678, durationSeconds: 180, createdAt: '2026-08-26T09:00:00Z', updatedAt: '2026-08-26T09:00:00Z' },
    { id: '22222222-2222-4222-8222-222222222222', title: 'Second Bloom', artist: 'Mica', album: null, position: 1, published: false, audioMime: null, audioSizeBytes: 0, artworkMime: null, artworkSizeBytes: 0, durationSeconds: null, createdAt: '2026-08-26T09:00:00Z', updatedAt: '2026-08-26T09:00:00Z' },
  ],
}

const radioMetrics = { track_count: 2, published_count: 1, total_audio_bytes: 12345, total_duration_seconds: 180 }
const radioAnalysis = {
  sizeBytes: 2048, durationSeconds: 398, codec: 'MP3', bitrateKbps: 128, bitrateMode: null, sampleRateHz: 44100, channels: 2,
  title: 'Cemeteries', artist: 'Sodus', album: 'Cemeteries', trackNumber: null, year: null, embeddedArtwork: null,
  filenameSuggestion: { title: 'Cemeteries', artist: 'Sodus', inferred: true }, source: 'id3',
}

async function fulfillRadioAnalysis(route: Route, analysis = radioAnalysis, delayMs = 0) {
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ analysis, optimization: { recommended: false, reason: 'already-efficient' } }) })
}

async function mockAdminApi(
  page: Page,
  options: {
    totpStatus?: { enrolled: boolean; confirmed: boolean }
    radioTracks?: unknown
    radioMetrics?: unknown
    radioFailure?: boolean
    onAudioAnalyze?: (route: Route, call: number) => Promise<void>
    onTrackCreate?: (route: Route) => Promise<void>
  } = {},
) {
  let audioAnalyzeCalls = 0
  await page.route('**/api/admin**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api\/admin\/?/, '')
    const method = route.request().method()
    if (options.radioFailure && method === 'GET' && path.startsWith('radio/')) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'internal-error' }) })
      return
    }
    if (method === 'POST') {
      if (path === 'radio/metadata/resolve') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ metadata: { provider: 'spotify', sourceUrl: 'https://open.spotify.com/track/test', externalId: 'test', title: 'Cemeteries', artist: 'Sodus', album: 'Cemeteries', artworkUrl: null, durationSeconds: null, year: null, evidence: ['Spotify metadata retrieved'] } }) })
        return
      }
      if (path === 'radio/metadata/match') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ match: { level: 'High', score: 100, evidence: [{ state: 'pass', text: 'Title matches' }, { state: 'pass', text: 'Artist matches' }] } }) })
        return
      }
      if (path.startsWith('radio/audio/analyze')) {
        audioAnalyzeCalls += 1
        if (options.onAudioAnalyze) await options.onAudioAnalyze(route, audioAnalyzeCalls)
        else await fulfillRadioAnalysis(route)
        return
      }
      if (path.startsWith('auth/totp/enroll')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(enrollment) })
        return
      }
      if (path.startsWith('radio/tracks') && path.includes('reorder')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
        return
      }
      if (path === 'radio/tracks') {
        if (options.onTrackCreate) await options.onTrackCreate(route)
        else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ track: radioTracks.tracks[0] }) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      return
    }
    if (method === 'PUT' && path.startsWith('radio/tracks')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ track: radioTracks.tracks[0] }) })
      return
    }
    if (method === 'PATCH' && path.startsWith('radio/tracks/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ track: radioTracks.tracks[0] }) })
      return
    }
    if (method === 'DELETE' && path.startsWith('radio/tracks/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      return
    }
    let body: unknown = {}
    if (path === '') body = dashboard
    else if (path === 'auth/totp/status') body = options.totpStatus ?? { enrolled: false, confirmed: false }
    else if (path === 'auth') body = {}
    else if (path.startsWith('radio/metrics')) body = options.radioMetrics ?? radioMetrics
    else if (path.startsWith('radio/tracks')) body = options.radioTracks ?? radioTracks
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

// Public radio artwork requests from the admin library are served by a stub so
// cover thumbnails never hit the (database-less) E2E server.
async function mockPublicRadioMedia(page: Page) {
  await page.route('**/api/radio/tracks/*/artwork', (route) => {
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') })
  })
  await page.route('**/api/radio/tracks/*/audio', (route) => {
    route.fulfill({ status: 200, contentType: 'audio/mpeg', headers: { 'Accept-Ranges': 'bytes', 'Content-Length': '1024' }, body: Buffer.alloc(1024, 0) })
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

  test('renders the LH Radio library with tracks and actions', async ({ page }) => {
    await mockPublicRadioMedia(page)
    await page.goto('/app/admin/radio')
    await expect(page.getByRole('heading', { name: 'LH Radio Library' })).toBeVisible()
    await expect(page.getByText('First Light')).toBeVisible()
    await expect(page.getByText('Second Bloom')).toBeVisible()
    await expect(page.locator('.radio-status.is-published')).toHaveText('Published')
    await expect(page.locator('.radio-status:not(.is-published)')).toHaveText('Unpublished')
    await expect(page.getByRole('button', { name: '+ Add track' })).toBeVisible()
  })

  test('renders the real zero-track and zero-metrics state without crashing', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, {
      radioTracks: { tracks: [] },
      radioMetrics: {
        track_count: 0,
        published_count: 0,
        total_audio_bytes: '0',
        total_duration_seconds: '0',
      },
    })
    await page.goto('/app/admin/radio')
    await expect(page.getByRole('heading', { name: 'LH Radio Library' })).toBeVisible()
    await expect(page.getByText('No tracks yet.')).toBeVisible()
    await expect(page.getByText('0 B')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Workspace unavailable.' })).toHaveCount(0)
  })

  test('keeps Radio Admin mounted with an inline retry when Radio APIs fail', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, { radioFailure: true })
    await page.goto('/app/admin/radio')
    await expect(page.getByRole('heading', { name: 'LH Radio Library' })).toBeVisible()
    await expect(page.getByText('Radio data could not be loaded completely.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry Radio library' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Workspace unavailable.' })).toHaveCount(0)
  })

  test('opens the smart upload flow and shows ID3 audio analysis', async ({ page }) => {
    await page.goto('/app/admin/radio')
    await page.getByRole('button', { name: '+ Add track' }).click()
    await expect(page.getByRole('tab', { name: /Upload MP3/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Import Link/ })).toBeVisible()
    await page.locator('input[type=file]').first().setInputFiles({ name: 'Sodus - Cemeteries.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 synthetic fixture') })
    await expect(page.getByText('Audio analysis')).toBeVisible()
    await expect(page.getByText('ID3 + frame data')).toBeVisible()
    await expect(page.locator('input[required][maxlength="200"][value="Cemeteries"]')).toBeVisible()
    await expect(page.locator('input[required][maxlength="200"][value="Sodus"]')).toBeVisible()
  })

  test('labels file inspection as Analyzing audio and reserves Saving for submit', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, {
      onAudioAnalyze: (route) => fulfillRadioAnalysis(route, radioAnalysis, 200),
      onTrackCreate: async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ track: radioTracks.tracks[0] }) })
      },
    })
    await page.goto('/app/admin/radio')
    await page.getByRole('button', { name: '+ Add track' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add track' })
    await page.locator('input[type=file]').first().setInputFiles({ name: 'Sodus - Cemeteries.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 synthetic fixture') })
    await expect(page.getByRole('status')).toHaveText('Analyzing audio…')
    await expect(page.getByRole('button', { name: 'Analyzing audio…' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Saving…' })).toHaveCount(0)
    await expect(page.getByText('Audio analysis')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Add track', exact: true })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Add track', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await expect(page.getByRole('dialog', { name: 'Add track' })).toHaveCount(0)
  })

  test('shows a timeout error, keeps the file, and retries analysis', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, {
      onAudioAnalyze: async (route, call) => {
        if (call === 1) {
          await route.fulfill({ status: 408, contentType: 'application/json', body: JSON.stringify({ error: 'audio-analysis-timeout', message: 'Audio analysis took too long. Retry analysis.' }) })
          return
        }
        await fulfillRadioAnalysis(route)
      },
    })
    await page.goto('/app/admin/radio')
    await page.getByRole('button', { name: '+ Add track' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add track' })
    await page.locator('input[type=file]').first().setInputFiles({ name: 'retry-me.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 synthetic fixture') })
    await expect(page.getByRole('alert')).toHaveText('Audio analysis took too long. Retry analysis.')
    await expect(page.getByText(/retry-me\.mp3/)).toBeVisible()
    await page.getByRole('button', { name: 'Retry analysis' }).click()
    await expect(page.getByText('Audio analysis')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Add track', exact: true })).toBeEnabled()
  })

  test('keeps a failed file available and allows choosing another file', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, {
      onAudioAnalyze: async (route, call) => {
        if (call === 1) {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid-audio', message: 'Audio metadata could not be read.' }) })
          return
        }
        await fulfillRadioAnalysis(route)
      },
    })
    await page.goto('/app/admin/radio')
    await page.getByRole('button', { name: '+ Add track' }).click()
    const input = page.locator('input[type=file]').first()
    await input.setInputFiles({ name: 'broken.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 broken fixture') })
    await expect(page.getByRole('alert')).toHaveText('Audio metadata could not be read.')
    await expect(page.getByText(/broken\.mp3/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry analysis' })).toBeVisible()
    await input.setInputFiles({ name: 'replacement.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 replacement fixture') })
    await expect(page.getByText('Audio analysis')).toBeVisible()
  })

  test('a second file selection invalidates the older analysis response', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, {
      onAudioAnalyze: async (route) => {
        const filename = new URL(route.request().url()).searchParams.get('filename')
        const analysis = filename === 'second.mp3'
          ? { ...radioAnalysis, title: 'Second Track', artist: 'Second Artist' }
          : { ...radioAnalysis, title: 'Stale First Track', artist: 'Stale Artist' }
        try {
          await fulfillRadioAnalysis(route, analysis, filename === 'second.mp3' ? 10 : 300)
        } catch {
          // The first request is expected to be aborted by the second selection.
        }
      },
    })
    await page.goto('/app/admin/radio')
    await page.getByRole('button', { name: '+ Add track' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add track' })
    const input = page.locator('input[type=file]').first()
    await input.setInputFiles({ name: 'first.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 first fixture') })
    await expect(page.getByRole('status')).toHaveText('Analyzing audio…')
    await input.setInputFiles({ name: 'second.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 second fixture') })
    await expect(dialog.getByRole('textbox', { name: /Track title/ })).toHaveValue('Second Track')
    await page.waitForTimeout(350)
    await expect(dialog.getByRole('textbox', { name: /Track title/ })).toHaveValue('Second Track')
    await expect(dialog.locator('input[value="Stale First Track"]')).toHaveCount(0)
  })

  test('Cancel remains available while analysis is pending', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, {
      onAudioAnalyze: async (route) => {
        try {
          await fulfillRadioAnalysis(route, radioAnalysis, 500)
        } catch {
          // Closing the modal aborts the pending request.
        }
      },
    })
    await page.goto('/app/admin/radio')
    await page.getByRole('button', { name: '+ Add track' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add track' })
    await page.locator('input[type=file]').first().setInputFiles({ name: 'cancel.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 cancel fixture') })
    await expect(page.getByRole('status')).toHaveText('Analyzing audio…')
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Add track' })).toHaveCount(0)
  })

  test('keeps ID3 autofill and embedded artwork preview', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, {
      onAudioAnalyze: (route) => fulfillRadioAnalysis(route, {
        ...radioAnalysis,
        embeddedArtwork: { mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', description: 'Cover' },
      }),
    })
    await page.goto('/app/admin/radio')
    await page.getByRole('button', { name: '+ Add track' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add track' })
    await page.locator('input[type=file]').first().setInputFiles({ name: 'tagged.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 tagged fixture') })
    await expect(dialog.getByRole('textbox', { name: /Track title/ })).toHaveValue('Cemeteries')
    await expect(dialog.getByRole('textbox', { name: /Artist/ })).toHaveValue('Sodus')
    await expect(page.locator('.radio-cover-preview')).toHaveAttribute('src', /^data:image\/png;base64,/)
  })

  test('resolves provider links as metadata-only suggestions', async ({ page }) => {
    await page.goto('/app/admin/radio')
    await page.getByRole('button', { name: '+ Add track' }).click()
    await page.getByRole('tab', { name: /Import Link/ }).click()
    await page.getByPlaceholder('https://open.spotify.com/track/...').fill('https://open.spotify.com/track/test')
    await page.getByRole('button', { name: 'Resolve metadata' }).click()
    await expect(page.getByText('Metadata retrieved')).toBeVisible()
    await expect(page.locator('input[required][maxlength="200"][value="Cemeteries"]')).toBeVisible()
    await expect(page.getByText(/Links import metadata only/)).toBeVisible()
  })

  test('shows Smart Match evidence after a link and attached MP3', async ({ page }) => {
    await page.goto('/app/admin/radio')
    await page.getByRole('button', { name: '+ Add track' }).click()
    await page.getByRole('tab', { name: /Import Link/ }).click()
    await page.getByPlaceholder('https://open.spotify.com/track/...').fill('https://open.spotify.com/track/test')
    await page.getByRole('button', { name: 'Resolve metadata' }).click()
    await page.locator('input[type=file]').first().setInputFiles({ name: 'Sodus - Cemeteries.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 synthetic fixture') })
    await expect(page.getByText('Smart Match · High')).toBeVisible()
    await expect(page.getByText('✓ Title matches')).toBeVisible()
  })

  test('turns malformed Radio numeric payloads into an inline contract error', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, {
      radioTracks: { tracks: [] },
      radioMetrics: {
        track_count: 0,
        published_count: 0,
        total_audio_bytes: 'not-a-number',
        total_duration_seconds: 0,
      },
    })
    await page.goto('/app/admin/radio')
    await expect(page.getByRole('heading', { name: 'LH Radio Library' })).toBeVisible()
    await expect(page.getByText(/invalid total audio bytes/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry Radio library' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Workspace unavailable.' })).toHaveCount(0)
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

test.describe('admin TOTP enrollment QR', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page)
  })

  async function reachTotpSetup(page: Page) {
    await signInOnly(page)
    await page.goto('/app/admin')
    // Complete the email step (mock accepts any 6-digit code).
    await page.getByLabel('Email code').fill('123456')
    await page.getByRole('button', { name: 'Verify email' }).click()
    await expect(page.getByRole('button', { name: 'Setup Authenticator' })).toBeVisible()
    await page.getByRole('button', { name: 'Setup Authenticator' }).click()
  }

  test('renders a real QR element from the otpauth URI', async ({ page }) => {
    await reachTotpSetup(page)
    const qr = page.locator('.admin-qr-box svg')
    await expect(qr).toBeVisible()
    // The QR SVG encodes the backend otpauth URI in its path data.
    expect(await qr.getAttribute('aria-label')).toBe('Authenticator QR code')
  })

  test('does not display the raw otpauth URI by default', async ({ page }) => {
    await reachTotpSetup(page)
    await expect(page.getByText('otpauth://totp/', { exact: false })).toHaveCount(0)
    // The full URI should not appear as visible text anywhere.
    expect(await page.locator('body').innerText()).not.toContain('otpauth://totp/')
  })

  test('hides the manual setup key by default and reveals it on click', async ({ page }) => {
    await reachTotpSetup(page)
    // Setup key hidden by default.
    await expect(page.getByTestId('totp-setup-key')).toHaveCount(0)
    // Reveal via explicit click.
    await page.getByRole('button', { name: "Can't scan the QR? Show setup key" }).click()
    await expect(page.getByTestId('totp-setup-key')).toBeVisible()
    await expect(page.getByTestId('totp-setup-key')).toHaveText('JBSWY3DPEHPK3PXP')
    // Hide again.
    await page.getByRole('button', { name: 'Hide setup key' }).click()
    await expect(page.getByTestId('totp-setup-key')).toHaveCount(0)
  })

  test('successful confirmation clears enrollment material from the UI', async ({ page }) => {
    await reachTotpSetup(page)
    // Confirm with any 6-digit code (mock accepts it and stores an admin token).
    await page.getByLabel('Authenticator code').fill('123456')
    await page.getByRole('button', { name: 'Confirm TOTP' }).click()
    // After elevation the dashboard loads; the QR and setup key are gone.
    await expect(page.getByText('Platform metrics')).toBeVisible()
    await expect(page.locator('.admin-qr-box svg')).toHaveCount(0)
    await expect(page.getByTestId('totp-setup-key')).toHaveCount(0)
  })

  test('subsequent admin login does not expose the TOTP secret', async ({ page }) => {
    // Simulate an already-elevated browser (admin session present).
    await authenticate(page)
    await page.goto('/app/admin')
    await expect(page.getByText('Platform metrics')).toBeVisible()
    // No QR, no setup key, no raw URI anywhere on the dashboard.
    expect(await page.locator('body').innerText()).not.toContain('otpauth://totp/')
    expect(await page.locator('body').innerText()).not.toContain('JBSWY3DPEHPK3PXP')
    await expect(page.locator('.admin-qr-box svg')).toHaveCount(0)
  })

  test('already-enrolled state uses the existing Authenticator without offering setup', async ({ page }) => {
    await page.unroute('**/api/admin**')
    await mockAdminApi(page, { totpStatus: { enrolled: true, confirmed: true } })
    await signInOnly(page)
    await page.goto('/app/admin')
    await page.getByLabel('Email code').fill('123456')
    await page.getByRole('button', { name: 'Verify email' }).click()
    await expect(page.getByText('Authenticator already configured')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Setup Authenticator' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue Authenticator setup' })).toHaveCount(0)
    await expect(page.getByLabel('Authenticator code')).toBeVisible()
  })
})
