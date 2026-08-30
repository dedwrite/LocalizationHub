import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectDialogueContext, inferContextFromRecord } from '@localizationhub/core'
import { I18nProvider } from '@localizationhub/i18n'
import DialogueContextStrip from './DialogueContextStrip'

afterEach(() => vi.unstubAllGlobals())
const record = { speaker: 'Sofia', speaker_gender: 'female', receiver: 'KuyaGrab', receiver_gender: 'male', scene: '1a/$.inkb' }

describe.each(['en', 'ar'])('Desktop context strip in %s', (locale) => {
  it.each(['parsed', 'extracted'])('presents normalized %s roles and isolates source values', (kind) => {
    vi.stubGlobal('window', { localStorage: { getItem: () => locale } })
    const context = kind === 'parsed' ? detectDialogueContext(record)! : inferContextFromRecord(record).context
    const html = renderToStaticMarkup(<I18nProvider><DialogueContextStrip context={context} /></I18nProvider>)
    const text = html.replace(/<[^>]*>/g, '')
    expect(text).toBe(locale === 'en'
      ? 'Speaker: Sofia (female) · → Listener: KuyaGrab (male) · Scene: 1a/$.inkb'
      : 'المتحدث: Sofia (أنثى) · → المستمع: KuyaGrab (ذكر) · المشهد: 1a/$.inkb')
    expect(html).toContain('<bdi>KuyaGrab</bdi>')
    expect(html).toContain('data-i18n-skip')
  })

  it('presents the whole listener group, never an arbitrary single listener', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => locale } })
    const context = detectDialogueContext({ receivers: ['Sofia', 'Mark'] })!
    const html = renderToStaticMarkup(<I18nProvider><DialogueContextStrip context={context} /></I18nProvider>)
    expect(html.replace(/<[^>]*>/g, '')).toBe(locale === 'en' ? '→ Listeners: Sofia, Mark' : '→ المستمعون: Sofia, Mark')
  })
})
