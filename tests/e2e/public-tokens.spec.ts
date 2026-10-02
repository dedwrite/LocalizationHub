import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const publicSource = 'website/src'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio/**', route => route.fulfill({ json: { tracks: [] } }))
})

// The landing declares eight type steps, three shape steps and fourteen colour
// roles (website/DESIGN.md). These two guards check the declaration and the
// render: the first reads every rule, the second reads every painted pixel.
for (const locale of ['en', 'ar']) {
  test(`the landing paints only its declared tokens in ${locale}`, async ({ page }) => {
    const width = page.viewportSize()?.width ?? 1440
    test.skip(![1440, 1280, 1024, 390].includes(width), 'the lock is verified at 1440, 1280, 1024 and 390')
    await page.addInitScript(value => localStorage.setItem('localizationhub.ui-locale.v1', value), locale)
    await page.goto('/')
    await expect(page.locator('#public-site')).toBeVisible()
    const report = await page.evaluate(() => {
      const site = document.querySelector('#public-site') as HTMLElement
      const probe = document.createElement('span')
      site.appendChild(probe)
      const declared = getComputedStyle(site)
      const colours = new Map<string, string>()
      for (const role of ['bg', 'surface', 'surface-2', 'line', 'text', 'soft', 'muted', 'accent', 'accent-strong', 'accent-ink', 'selected', 'glyph', 'success', 'danger']) {
        probe.style.color = `var(--${role})`
        colours.set(getComputedStyle(probe).color, `--${role}`)
      }
      const radii = new Set<string>(['0px'])
      for (const step of ['--r-1', '--r-2', '--r-3']) {
        probe.style.borderRadius = `var(${step})`
        radii.add(getComputedStyle(probe).borderTopLeftRadius)
      }
      radii.add('50%')
      probe.remove()

      const unmappedColours: string[] = []
      const unmappedBackgrounds: string[] = []
      const unmappedRadii: string[] = []
      const underTwelve: string[] = []
      const foreignFamilies: string[] = []
      const label = (element: Element) => `${element.tagName.toLowerCase()}${typeof element.className === 'string' && element.className.trim() ? '.' + element.className.trim().split(/\s+/).join('.') : ''}`
      for (const element of site.querySelectorAll('*')) {
        if (element.closest('.language-field, svg') || ['SCRIPT', 'STYLE', 'AUDIO'].includes(element.tagName)) continue
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden' || !element.getClientRects().length) continue
        const ownText = [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        if (ownText) {
          if (!colours.has(style.color)) unmappedColours.push(`${label(element)} → ${style.color}`)
          if (Number.parseFloat(style.fontSize) < 12) underTwelve.push(`${label(element)} → ${style.fontSize}`)
          const family = style.fontFamily.split(',')[0].replace(/["']/g, '').trim()
          if (!['LH Public', 'LH Public Arabic', 'ui-monospace'].includes(family)) foreignFamilies.push(`${label(element)} → ${family}`)
        }
        if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && !colours.has(style.backgroundColor)) unmappedBackgrounds.push(`${label(element)} → ${style.backgroundColor}`)
        for (const corner of [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]) {
          if (!radii.has(corner)) unmappedRadii.push(`${label(element)} → ${corner}`)
        }
      }
      return {
        roles: [...colours.values()],
        radii: [...radii],
        unmappedColours,
        unmappedBackgrounds,
        unmappedRadii,
        underTwelve,
        foreignFamilies,
      }
    })
    expect(report.roles).toHaveLength(14)
    expect(report.radii.sort()).toEqual(['0px', '12px', '50%', '6px', '8px'])
    expect(report.unmappedColours).toEqual([])
    expect(report.unmappedBackgrounds).toEqual([])
    expect(report.unmappedRadii).toEqual([])
    expect(report.underTwelve).toEqual([])
    expect(report.foreignFamilies).toEqual([])
  })
}

test('every rule that addresses the landing draws from the declared tokens', async ({ page }) => {
  await page.goto('/')
  const report = await page.evaluate(() => {
    const colourLiteral = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i
    // A named step, a relative size or `inherit` all keep the scale; a non-zero
    // raw px measurement is the only way to leave it.
    const rawSize = (value: string) => (value.match(/\d*\.?\d+px/g) ?? []).some(token => Number.parseFloat(token) !== 0)
    const family = /var\(--font-(ui|arabic|mono|glyph)\)|^inherit$/
    const shadow = /^none$/
    const ruleList: CSSStyleRule[] = []
    const collect = (rules: CSSRuleList) => {
      for (const rule of [...rules]) {
        if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules.length) collect((rule as CSSGroupingRule).cssRules)
        else if ('selectorText' in rule && (rule as CSSStyleRule).selectorText.includes('#public-site')) ruleList.push(rule as CSSStyleRule)
      }
    }
    for (const sheet of document.styleSheets) {
      try { collect(sheet.cssRules) } catch { /* a stylesheet the page cannot read */ }
    }
    const violations: string[] = []
    let declarations = 0
    let tokens = 0
    let tokenBlock = ''
    for (const rule of ruleList) {
      // The canonical block itself is the one place allowed to name raw values;
      // it is the only rule that declares the palette roles.
      if (rule.selectorText === '#public-site' && rule.style.getPropertyValue('--bg')) { tokenBlock = rule.style.cssText; continue }
      const selector = rule.selectorText.replace(/\s+/g, ' ').slice(0, 90)
      for (const declaration of rule.style.cssText.split(';')) {
        const separator = declaration.indexOf(':')
        if (separator < 0) continue
        const property = declaration.slice(0, separator).trim().toLowerCase()
        const value = declaration.slice(separator + 1).trim()
        if (!value) continue
        declarations += 1
        if (value.includes('var(--')) tokens += 1
        const colourish = property === 'color' || property.startsWith('background') || property.startsWith('border') || property === 'outline-color' || property === 'caret-color' || property === 'fill' || property === 'stroke'
        if (colourish && colourLiteral.test(value)) violations.push(`${selector} { ${property}: ${value} }`)
        else if ((property === 'font-size' || property === 'font') && rawSize(value) && !value.includes('var(--fs-')) violations.push(`${selector} { ${property}: ${value} }`)
        else if (property.endsWith('border-radius') && rawSize(value) && !value.includes('var(--r-')) violations.push(`${selector} { ${property}: ${value} }`)
        else if (property === 'font-family' && !family.test(value)) violations.push(`${selector} { ${property}: ${value} }`)
        else if (property === 'box-shadow' && !shadow.test(value)) violations.push(`${selector} { ${property}: ${value} }`)
      }
    }
    return {
      rules: ruleList.length,
      declarations,
      tokens,
      violations,
      roles: ['bg', 'surface', 'surface-2', 'line', 'text', 'soft', 'muted', 'accent', 'accent-strong', 'accent-ink', 'selected', 'glyph', 'success', 'danger'].filter(role => tokenBlock.includes(`--${role}:`)),
      glyphFamily: tokenBlock.includes('--font-glyph:'),
    }
  })
  expect(report.rules).toBeGreaterThan(100)
  expect(report.declarations).toBeGreaterThan(400)
  expect(report.tokens).toBeGreaterThan(100)
  expect(report.roles).toHaveLength(14)
  expect(report.glyphFamily).toBe(true)
  expect(report.violations).toEqual([])
})

// Selectors that only the landing uses. A layer the application also loads may
// not mention any of them: two stylesheets writing the same landing rule is how
// a contradicting second set of landing styles grew here once already.
const landingSelectors = [
  '#public-site', 'landing-main', 'hero', 'section-intro', 'faq-list', 'rtl-showcase',
  'live-preview', 'context-demo', 'split-section', 'signal-strip', 'format-guide',
  'workflow-line', 'feature-grid', 'engine-card', 'engine-grid', 'engine-boundary',
  'release-section', 'format-row', 'context-people', 'field-notes', 'language-glyph',
]

const stylesheetSources = () => {
  const files: string[] = []
  const walk = (directory: string) => {
    for (const entry of readdirSync(join(process.cwd(), directory), { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.css')) files.push(path)
    }
  }
  walk(publicSource)
  return files.map(file => [file.replace(/\\/g, '/'), readFileSync(join(process.cwd(), file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')] as const)
}

test('the landing has exactly one stylesheet owner', async () => {
  const sources = stylesheetSources()
  const owner = `${publicSource}/public-site.css`
  const owners = sources.filter(([, text]) => text.includes('#public-site')).map(([file]) => file)
  expect(owners).toEqual([owner])
  // Every other stylesheet has to stay out of the landing entirely; a shared
  // layer that needs a landing rule moves that rule into the owner instead.
  const intrusions = sources
    .filter(([file]) => file !== owner)
    .map(([file, text]) => `${file}: ${landingSelectors.filter(selector => text.includes(selector)).join(', ')}`)
    .filter(entry => !entry.endsWith(': '))
  expect(intrusions).toEqual([])
  const names = sources.map(([file]) => file.split(/[\\/]/).pop())
  expect(names).not.toContain('marketing-atmosphere.css')
  expect(names).not.toContain('landing-experience.css')
  const shell = readFileSync(join(process.cwd(), `${publicSource}/App.tsx`), 'utf8')
  expect(shell).not.toContain('marketing-atmosphere')
  expect(shell).not.toContain('landing-experience')
})

// The download and legal routes belong to styles.css (DESIGN.md). The layers
// the application loads after it stay out of those routes, and the two rhythm
// tokens they rely on are declared in the owner only.
const innerPageSelectors = [
  'inner-page', 'page-lede', 'download-layout', 'download-panel', 'panel-kicker',
  'panel-mark', 'download-fact', 'download-access-note', 'document-page', 'not-found',
]

test('the download and legal pages have exactly one stylesheet owner', () => {
  const sources = stylesheetSources()
  const owner = `${publicSource}/styles.css`
  const mentions = (text: string) => innerPageSelectors.filter(selector => text.includes(selector)).join(', ')
  const owners = sources.filter(([, text]) => mentions(text)).map(([file]) => file)
  expect(owners).toEqual([owner])
  const intrusions = sources.filter(([file]) => file !== owner).map(([, text]) => mentions(text)).filter(Boolean)
  expect(intrusions).toEqual([])
  const foreignTokens = sources
    .filter(([file]) => file !== owner)
    .map(([file, text]) => `${file}: ${text.match(/--web-(?:content-gap|panel-radius)\s*:/g)?.join(', ') ?? ''}`)
    .filter(entry => !entry.endsWith(': '))
  expect(foreignTokens).toEqual([])
})

test('the landing never leaves its own origin for a font', async ({ page, baseURL }) => {
  const fonts: string[] = []
  page.on('request', request => { if (request.resourceType() === 'font') fonts.push(request.url()) })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(fonts.length).toBeGreaterThan(0)
  const origin = new URL(baseURL!).origin
  expect(fonts.filter(url => new URL(url).origin !== origin)).toEqual([])
})
