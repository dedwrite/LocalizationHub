import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { UiTheme, ActionLink, IconButton, StatusBadge } from './index'

test('theme is opt-in and primitives retain link and button contracts', () => {
  const html = renderToStaticMarkup(<UiTheme><ActionLink href="/app/local">Open</ActionLink><IconButton label="Pause" disabled>Ⅱ</IconButton><StatusBadge tone="success">Valid</StatusBadge></UiTheme>)
  expect(html).toContain('data-lh-theme="product"')
  expect(html).toMatch(/<a[^>]+href="\/app\/local"/)
  expect(html).toContain('aria-label="Pause"')
  expect(html).toContain('disabled=""')
  expect(html).toContain('data-tone="success"')
})
test('theme styles cannot activate outside the opt-in boundary', () => {
  const css = readFileSync('packages/ui/src/theme.css', 'utf8')
  expect(css).not.toMatch(/:root|(?:^|})\s*(?:body|button|a)\s*[{,:]/m)
  expect(css).toContain('[data-lh-theme="product"]')
  expect(css).toContain('prefers-reduced-motion')
})
