import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'set SERVE_PUBLIC_WEBSITE=1&& set ENABLE_EXPERIMENTAL_CLOUD_API=0&& set PORT=8787&& node collaboration-server/server.mjs',
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
  ],
})
