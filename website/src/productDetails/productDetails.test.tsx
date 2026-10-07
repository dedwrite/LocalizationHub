import {renderToStaticMarkup} from 'react-dom/server'
import {expect, test} from 'vitest'
import {I18nProvider} from '@localizationhub/i18n'
import ProductDetails from './ProductDetails'

test.each(['en', 'ar'] as const)('Product exposes real features and preserves legacy destinations in %s', locale => {
  const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><ProductDetails /></I18nProvider>)
  expect(html).toContain(locale === 'en' ? 'Everything around the line.' : 'كل ما يحيط بالسطر.')
  for(const id of ['product','context','arabic','cloud','extraction','engines','formats','workspace','workflow','privacy','faq']) expect(html.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1)
  for(const href of ['/app/local','/download','/reference','/privacy']) expect(html).toContain(`href="${href}"`)
  for(const name of ['friday-clock-secret-trigger','faq-locale-secret-trigger','secret-trigger','field-tip','on-device-secret-trigger']) expect(html).toContain(name)
  expect(html).toContain('dir="rtl"')
  expect(html).toContain('dir="ltr"')
  expect(html).not.toContain('editor-workspace.png')
})
