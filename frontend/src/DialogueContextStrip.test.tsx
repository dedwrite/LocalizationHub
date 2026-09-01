import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectDialogueContext, inferContextFromRecord } from '@localizationhub/core'
import { I18nProvider } from '@localizationhub/i18n'
import DialogueContextStrip from './DialogueContextStrip'

afterEach(() => vi.unstubAllGlobals())
const record = { speaker: 'Sofia', speaker_gender: 'female', receiver: 'KuyaGrab', receiver_gender: 'male', scene: '1a/$.inkb' }

describe.each(['en', 'ar'])('Desktop context strip in %s', (locale) => {
  it.each(['parsed', 'extracted'])('presents normalized %s roles as distinct chips', (kind) => {
    vi.stubGlobal('window', { localStorage: { getItem: () => locale } })
    const context = kind === 'parsed' ? detectDialogueContext(record)! : inferContextFromRecord(record).context
    const html = renderToStaticMarkup(<I18nProvider><DialogueContextStrip context={context} /></I18nProvider>)
    expect(html).toContain('class="dialogue-context-strip"')
    expect(html).toContain('data-role="speaker"')
    expect(html).toContain('data-role="listener"')
    expect(html).toContain('<bdi>Sofia</bdi>')
    expect(html).toContain('<bdi>KuyaGrab</bdi>')
    expect(html).toContain('<bdi>1a/$.inkb</bdi>')
    expect(html).toContain('data-i18n-skip')
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (locale === 'en') {
      expect(text).toContain('Speaker:')
      expect(text).toContain('Listener:')
      expect(text).toContain('Scene:')
    } else {
      expect(text).toContain('المتحدث:')
      expect(text).toContain('المستمع:')
      expect(text).toContain('المشهد:')
    }
  })

  it('presents the whole listener group, never an arbitrary single listener', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => locale } })
    const context = detectDialogueContext({ receivers: ['Sofia', 'Mark'] })!
    const html = renderToStaticMarkup(<I18nProvider><DialogueContextStrip context={context} /></I18nProvider>)
    expect(html).toContain('data-role="listener"')
    expect(html).toContain('<bdi>Sofia</bdi>')
    expect(html).toContain('<bdi>Mark</bdi>')
    expect(html).not.toContain('data-role="speaker"')
  })
})
