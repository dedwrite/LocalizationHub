import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '@localizationhub/i18n'
import { expect, test } from 'vitest'
import HomePage from './HomePage'
import { legacyProductDestination } from './legacyAnchors'
import { metadataFor } from '../publicMetadata'

test.each(['en', 'ar'] as const)('Home presents real destinations and independent text directions in %s', locale => {
  const html = renderToStaticMarkup(React.createElement(I18nProvider, {initialLocale: locale, children: <HomePage />}))
  for (const href of ['/app/local', '/product', '/reference', '/download']) expect(html).toContain(`href="${href}"`)
  expect(html).toContain('dir="ltr"')
  expect(html).toContain('dir="rtl"')
  expect(html).toContain('data-i18n-skip')
  expect(html).not.toContain('class="feature-grid"')
  expect(html).toContain(locale === 'en' ? 'The editor is the product.' : 'المحرّر هو المنتج.')
  expect(html).toContain('href="https://github.com/dedwrite/LocalizationHub"')
  expect(html).not.toContain('GitHub (private)')
})
test('old known sections retain destinations without hijacking unknown fragments', () => {
  expect(legacyProductDestination('#context')).toBe('/product#context')
  expect(legacyProductDestination('#engines')).toBe('/product#engines')
  expect(legacyProductDestination('#anything')).toBeNull()
  expect(legacyProductDestination('#field-notes')).toBeNull()
  expect(legacyProductDestination('#%')).toBeNull()
  expect(metadataFor('/product').canonical).toBe('https://localizationhub.app/product')
  expect(metadataFor('/product').robots).toBe('index, follow')
})
