import {test, expect} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const locale of ['en','ar']) test(`Local editor uses the product palette and keeps editing in ${locale}`, async ({page},testInfo) => {
  await page.addInitScript(value => localStorage.setItem('localizationhub.ui-locale.v1',value),locale)
  await page.goto('/app/local?sample=last-broadcast')
  const editor = page.getByRole('textbox', {name:locale === 'ar' ? 'الترجمة' : 'Translation', exact:true})
  await expect(editor).toBeVisible()
  await expect(page.locator('.field-tip')).toHaveCount(0)
  const accent = await editor.evaluate(el => getComputedStyle(el).getPropertyValue('--app-accent').trim())
  expect(accent).toBe('#bafa61')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const violations = (await new AxeBuilder({page}).include('main').analyze()).violations
  expect(violations).toEqual([])
  await page.screenshot({path:testInfo.outputPath('editor.png'),fullPage:true})
  await editor.fill('Synthetic draft {player_name}')
  await expect(editor).toHaveValue('Synthetic draft {player_name}')
})
