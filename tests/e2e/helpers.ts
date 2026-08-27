import type { Page } from '@playwright/test'

/*
 * Shared helpers for tests that run on both desktop and mobile projects.
 *
 * The mobile workspace uses a dedicated Entries / Editor / Tools bottom
 * navigation. These helpers navigate to a surface only when the mobile nav is
 * present, leaving the desktop three-pane layout untouched.
 */

export function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize()
  return Boolean(viewport && viewport.width < 768)
}

async function openSurface(page: Page, label: string) {
  if (!isMobileViewport(page)) return
  const nav = page.locator('.mob-nav button', { hasText: label })
  // The bottom nav renders after the project finishes loading; wait for it.
  await nav.waitFor({ state: 'visible', timeout: 15000 })
  // `force` avoids Playwright's sub-pixel "stable" check, which is unreliable
  // for `1fr` grid columns that produce fractional widths on some engines.
  await nav.click({ force: true })
}

export async function openEntries(page: Page) {
  await openSurface(page, 'Entries')
}

export async function openEditor(page: Page) {
  await openSurface(page, 'Editor')
}

export async function openTools(page: Page) {
  await openSurface(page, 'Tools')
}
