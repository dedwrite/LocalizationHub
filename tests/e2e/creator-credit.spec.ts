import {test, expect} from '@playwright/test'

for (const route of ['/', '/product', '/download', '/reference', '/godot', '/unreal', '/unity', '/formats/json', '/formats/po', '/features/translation-memory', '/privacy', '/terms', '/not-found']) {
  test(`Creator credit is present on ${route}`, async ({page}) => {
    await page.goto(route)
    await expect(page.locator('[data-lh-theme="product"]')).toBeVisible()
    const credit = page.getByRole('link', {name:'DEDWRITE', exact:true})
    await expect(credit).toHaveCount(1)
    await expect(credit).toHaveAttribute('href','https://dedwrite.xyz/')
    await expect(credit).toHaveAttribute('rel','noopener noreferrer')
    await credit.scrollIntoViewIfNeeded()
    await expect(credit).toBeVisible()
  })
}
