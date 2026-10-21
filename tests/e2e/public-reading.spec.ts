import {test, expect} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const routes = ['/download','/reference','/godot','/unreal','/unity','/formats/json','/formats/po','/features/translation-memory','/privacy','/terms','/missing-page']
for (const locale of ['en','ar']) for (const route of routes) {
  test(`${locale} reading surface ${route} retains content, palette and access`, async ({page},testInfo) => {
    await page.emulateMedia({reducedMotion:'reduce'})
    await page.addInitScript(value => localStorage.setItem('localizationhub.ui-locale.v1',value),locale)
    const errors: string[] = []
    page.on('pageerror',error => errors.push(error.message))
    await page.goto(route)
    const root = page.locator('.public-reading')
    await expect(root).toHaveAttribute('data-lh-theme','product')
    await expect(root.locator('.home-shell')).toHaveAttribute('dir',locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.locator('main')).not.toHaveText('')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const colours = await root.evaluateAll(elements => elements.flatMap(root => [...root.querySelectorAll('h1,h2,p,a,button,code')].map(el => getComputedStyle(el).color)))
    expect(colours.filter(colour => /rgb\((185, 160, 237|215, 195, 247|167, 139, 250)\)/.test(colour))).toEqual([])
    expect((await new AxeBuilder({page}).include('.public-reading').analyze()).violations).toEqual([])
    expect(errors).toEqual([])
    await page.screenshot({path:testInfo.outputPath('reading.png'),fullPage:true})
  })
}

test('public Windows checksum and legal contents are accessible', async ({page}) => {
  await page.goto('/download')
  await expect(page.getByRole('link', {name: 'Download for Windows', exact:true})).toHaveAttribute('href', /^https:\/\/github.com\/dedwrite\/LocalizationHub\/releases\/download\/.+\.exe$/)
  await page.locator('.download-verification summary').click()
  await expect(page.locator('.download-digest')).toBeVisible()
  await page.goto('/privacy')
  await page.locator('.reading-contents summary').click()
  await page.locator('.reading-contents a').first().click()
  await expect(page).toHaveURL(/#section-1$/)
  await expect(page.locator('#section-1')).toBeVisible()
})
