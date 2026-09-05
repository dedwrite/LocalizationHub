import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  // Each real lifecycle worker owns a PostgreSQL/WASM instance in addition to
  // Chromium/WebKit. Bound memory/CPU contention for repeatable full-suite runs.
  workers: 4,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-website.mjs',
    env: { PORT: '8787' },
    url: 'http://127.0.0.1:8787/health',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 800 } } },
    { name: 'phone-390', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'phone-430', use: { ...devices['Pixel 5'], viewport: { width: 430, height: 932 } } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'tablet-1024', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 1366 } } },
    // WebKit / Safari coverage. Chromium viewport emulation is NOT a Safari
    // substitute: these run the real WebKit engine with iPhone/iPad UA + touch.
    // The admin console is a Chromium-focused operator tool (and axe's
    // color-contrast engine has a known WebKit `var()` resolution limitation),
    // so it stays on Chromium; these projects cover the workspace web app.
    { name: 'safari-desktop', use: { ...devices['Desktop Safari'] }, testIgnore: /admin\.spec\.ts/ },
    { name: 'iphone-390', use: { ...devices['iPhone 13'] }, testIgnore: /admin\.spec\.ts/ },
    { name: 'iphone-430', use: { ...devices['iPhone 14 Pro Max'] }, testIgnore: /admin\.spec\.ts/ },
    { name: 'ipad', use: { ...devices['iPad Pro 11'] }, testIgnore: /admin\.spec\.ts/ },
  ],
})
