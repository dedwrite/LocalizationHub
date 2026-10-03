import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The application palette is declared once in `src/app-palette.css` and every
// product layer references its roles. A raw colour below the declaration block
// is how eleven near-identical inks grew here once already, so this guard reads
// the stylesheets rather than trusting a later reviewer to notice.
//
// The landing (`public-site.css`) and the admin console (`admin-console.css`)
// own their own palettes and are checked by their own suites; this file's scope
// is the product surfaces and the shared shell they load.

const appRoot = 'website/src'
const palettePath = `${appRoot}/app-palette.css`

// Every product layer that paints. A file is listed here only once it has been
// converted, so the guard never passes on a file it does not read.
const paletteConsumers = [
  `${appRoot}/experience-polish.css`,
  `${appRoot}/app-workspace.css`,
  `${appRoot}/app-workspace.mobile.css`,
  `${appRoot}/workspace-tools.css`,
  `${appRoot}/workspace/workspace.css`,
  `${appRoot}/workspace/workspace.mobile.css`,
  `${appRoot}/workspace-deep-polish.css`,
  `${appRoot}/visual-refinement.css`,
  `${appRoot}/delight/delight.css`,
  `${appRoot}/delight/quiet-polish.css`,
]

// The shared shell declares the site's own tokens in `:root`; those
// declarations are the palette for the download and legal routes, so the guard
// reads them as declarations rather than as violations.
const shellPath = `${appRoot}/styles.css`

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '')

const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i

// A declaration whose property is a custom property declares a token; anything
// else has to reference one. The landing's own role block is the only place
// allowed raw values, and it lives in a different file.
function rawColourDeclarations(css: string): string[] {
  const violations: string[] = []
  for (const match of css.matchAll(/([-\w]+)\s*:\s*([^;{}]+)(?=;|})/g)) {
    const property = match[1]
    const value = match[2]
    if (property.startsWith('--')) continue
    if (!COLOUR_LITERAL.test(value)) continue
    violations.push(`${property}: ${value.replace(/\s+/g, ' ').trim()}`)
  }
  return violations
}

describe('the application palette is declared once and referenced everywhere', () => {
  test('the palette file declares every role the product layers use', () => {
    const palette = withoutComments(read(palettePath))
    const declared = new Set([...palette.matchAll(/--app-([a-z0-9-]+)\s*:/g)].map(match => match[1]))
    expect(declared.size).toBeGreaterThan(40)
    // The roles the product layers depend on most; a rename that drops one of
    // these is caught here rather than as a transparent border in the browser.
    for (const role of ['bg', 'well', 'panel', 'panel-2', 'line', 'line-soft', 'line-strong', 'text', 'text-2', 'text-7', 'accent', 'accent-2', 'accent-3', 'primary', 'primary-line', 'focus', 'success', 'danger', 'warning']) {
      expect(declared, `--app-${role} is missing from app-palette.css`).toContain(role)
    }
    // The declaration block is the one place in the file allowed a raw value.
    expect(rawColourDeclarations(palette)).toEqual([])
  })

  for (const path of paletteConsumers) {
    test(`${path} paints only declared roles`, () => {
      const css = withoutComments(read(path))
      expect(css.length).toBeGreaterThan(0)
      expect(rawColourDeclarations(css)).toEqual([])
    })

    test(`${path} references the palette rather than redeclaring it`, () => {
      const css = withoutComments(read(path))
      // Only the owner may introduce a new role, so a consumer may not declare
      // `--app-*` at all: a second definition would silently override the
      // palette for everything that loads after this file. Project identity is
      // the documented exception and travels as `--project-*`.
      expect([...css.matchAll(/--app-[a-z0-9-]+\s*:/g)].map(match => match[0])).toEqual([])
      // A consumer that stops referencing the palette entirely would also pass
      // the raw-value check if it painted nothing; require real references.
      expect(css.includes('var(--app-')).toBe(true)
    })
  }

  test('the shared shell keeps its raw values inside the token block only', () => {
    const css = withoutComments(read(shellPath))
    // The shell's own `:root` blocks declare the site tokens; everything below
    // them has to reference a token.
    const blocks = [...css.matchAll(/:root\s*\{[\s\S]*?\}/g)].map(match => match[0]).join('\n')
    const rest = css.replace(/:root\s*\{[\s\S]*?\}/g, '')
    expect(rawColourDeclarations(rest)).toEqual([])
    // The reading-white role the shell shares with the landing is declared here
    // so no shared rule depends on a fallback only the landing defined.
    expect(blocks).toContain('--text:')
    expect(blocks).toContain('--shadow-panel:')
  })

  test('no product layer falls back to a hard-coded colour inside var()', () => {
    for (const path of [...paletteConsumers, shellPath]) {
      const css = withoutComments(read(path))
      // `var(--text, #f0edf5)` is a declaration that the token does not exist;
      // the palette declares every role, so a fallback is a stale reference.
      const fallbacks = [...css.matchAll(/var\(--[a-z0-9-]+,\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi)].map(match => match[0])
      expect(fallbacks, `${path} has colour fallbacks`).toEqual([])
    }
  })
})
