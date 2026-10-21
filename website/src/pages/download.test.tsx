import {renderToStaticMarkup} from 'react-dom/server'
import {expect, test} from 'vitest'
import {I18nProvider} from '@localizationhub/i18n'
import {DownloadPage} from './InfoPages'
import {metadataFor} from '../publicMetadata'

test.each(['en', 'ar'] as const)('download exposes official installer and checksum without tester approval in %s', locale => {
  const html = renderToStaticMarkup(<I18nProvider initialLocale={locale}><DownloadPage /></I18nProvider>)
  expect(html).toContain('href="https://github.com/dedwrite/LocalizationHub/releases/download/v0.9.10/LocalizationHub_0.9.10_x64-setup.exe"')
  expect(html).toContain('href="https://github.com/dedwrite/LocalizationHub/releases/download/v0.9.10/LocalizationHub_0.9.10_x64-setup.exe.sha256"')
  expect(html).toContain('href="https://github.com/dedwrite/LocalizationHub/releases"')
  expect(html).toContain('v0.9.10')
  expect(html).toContain('SmartScreen')
  expect(html).not.toMatch(/approved testers|Request tester|مختبرين معتمدين|download-request|PRIVATE BUILD|نسخة خاصة/)
  expect(html).toContain('href="/app/local"')
})

test('download metadata describes public distribution', () => {
  expect(metadataFor('/download').description).toMatch(/download/i)
  expect(metadataFor('/download').description).not.toMatch(/private|tester/i)
})
