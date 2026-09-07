import { defineConfig } from 'vitest/config'

// Node's server tests and Playwright E2Es have their own full release gates.
// Do not execute their runner APIs (or ignored audit archives) inside Vitest.
export default defineConfig({
  test: { include: ['frontend/src/**/*.{test,spec}.{ts,tsx}', 'website/src/**/*.{test,spec}.{ts,tsx}', 'website/tests/**/*.{test,spec}.{ts,tsx}', 'packages/*/src/**/*.{test,spec}.{ts,tsx}'] },
})
