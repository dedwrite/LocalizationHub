import { describe, expect, it } from 'vitest'
import { messages } from './messages'
import { translate, translateUiText } from './index'

describe('LocalizationHub UI message catalog', () => {
  it('keeps every semantic key complete in English and Arabic', () => {
    const entries = Object.entries(messages)
    expect(entries.length).toBeGreaterThan(800)
    for (const [key, message] of entries) {
      expect(key).toMatch(/^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/)
      expect(message.en.trim(), `${key} English`).not.toBe('')
      expect(message.ar.trim(), `${key} Arabic`).not.toBe('')
    }
  })

  it('preserves matching interpolation parameters', () => {
    const parameters = (text: string) => [...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/gu)].map((match) => match[1]).sort()
    for (const message of Object.values(messages)) expect(parameters(message.ar)).toEqual(parameters(message.en))
  })

  it('uses Arabic plural-friendly dynamic count and pagination copy', () => {
    expect(translateUiText('ar', 'Page 2 of 7')).toBe('الصفحة 2 من 7')
    expect(translateUiText('ar', '15 entries')).toBe('15 نص')
    expect(translateUiText('en', '15 entries')).toBe('15 entries')
  })

  it('interpolates without injecting HTML', () => {
    expect(translate('en', 'common.language.label')).toBe('Interface language')
    expect(translateUiText('ar', '<script>alert(1)</script>')).toBe('<script>alert(1)</script>')
  })

  it('localizes dynamic workspace status and accessibility labels', () => {
    expect(translateUiText('ar', 'Saved')).toBe('محفوظ')
    expect(translateUiText('ar', 'Manual profile selected')).toBe('اختيرت قواعد الحماية يدويًا')
    expect(translateUiText('ar', 'Assigned to Me')).toBe('مُعيّن لي')
    expect(translateUiText('ar', 'Select menu.start')).toBe('تحديد menu.start')
    expect(translateUiText('ar', '5 — Untranslated')).toBe('5 — غير مترجم')
    expect(translateUiText('ar', 'Detected Unity · 86 confidence')).toBe('تم اكتشاف Unity · ثقة 86%')
  })

  it('keeps Radio taglines bilingual and in the intended order', () => {
    const keys = ['radio.player.tagline.one', 'radio.player.tagline.two', 'radio.player.tagline.three', 'radio.player.tagline.four'] as const
    expect(keys.map((key) => translate('en', key))).toEqual([
      'LOCALIZATIONHUB / JUST ONE MORE STRING',
      "LOCALIZATIONHUB / DON'T BREAK THE TOKENS",
      'LOCALIZATIONHUB / DEFINITELY THE LAST STRING',
      'LOCALIZATIONHUB / PLEASE KEEP THE TAGS',
    ])
    expect(keys.map((key) => translate('ar', key))).toEqual([
      'LOCALIZATIONHUB / بس سطر زيادة',
      'LOCALIZATIONHUB / لا تكسر التوكنز',
      'LOCALIZATIONHUB / آخر سطر… أكيد',
      'LOCALIZATIONHUB / تكفى خلّ التاقات',
    ])
  })
})
