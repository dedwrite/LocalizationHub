import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { messages, type MessageKey } from './messages'
import type { MessageValues, UiLocale } from './types'

export type { MessageKey, MessageValues, UiLocale }
export { messages }

export const UI_LOCALE_STORAGE_KEY = 'localizationhub.ui-locale.v1'

function readStoredLocale(): UiLocale {
  try {
    return window.localStorage.getItem(UI_LOCALE_STORAGE_KEY) === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

function interpolate(message: string, values: MessageValues = {}) {
  return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/gu, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  )
}

export function translate(locale: UiLocale, key: MessageKey, values?: MessageValues) {
  return interpolate(messages[key][locale], values)
}

const englishMessageIndex = new Map(Object.values(messages).map((message) => [message.en, message.ar]))

function dynamicArabicText(text: string) {
  const page = /^Page\s+(\d+)\s+of\s+(\d+)$/u.exec(text)
  if (page) return `الصفحة ${page[1]} من ${page[2]}`
  const entry = /^Entry\s+(\d+)\s+of\s+(\d+)$/iu.exec(text)
  if (entry) return `الإدخال ${entry[1]} من ${entry[2]}`
  const count = /^(\d+)\s+(entries|projects|users|tracks|comments|files|warnings|errors)$/iu.exec(text)
  if (count) {
    const nouns: Record<string, string> = { entries: 'إدخال', projects: 'مشروع', users: 'مستخدم', tracks: 'مقطع', comments: 'تعليق', files: 'ملف', warnings: 'تحذير', errors: 'خطأ' }
    return `${count[1]} ${nouns[count[2].toLowerCase()]}`
  }
  if (text === 'Assigned to Me') return 'مُعيّن لي'
  const selected = /^(\d+)\s+selected$/iu.exec(text)
  if (selected) return `${selected[1]} محدد`
  const remaining = /^(\d+)\s+remaining$/iu.exec(text)
  if (remaining) return `${remaining[1]} متبقي`
  const review = /^(\d+)\s+review$/iu.exec(text)
  if (review) return `${review[1]} للمراجعة`
  const select = /^Select\s+(.+)$/u.exec(text)
  if (select) return `تحديد ${select[1]}`
  const entryStatus = /^(.+)\s+—\s+(Error|Warning|Translated|Untranslated|Review|Draft|Needs Review|Approved)$/u.exec(text)
  if (entryStatus) {
    const statuses: Record<string, string> = { Error: 'خطأ', Warning: 'تحذير', Translated: 'مترجم', Untranslated: 'غير مترجم', Review: 'مراجعة', Draft: 'مسودة', 'Needs Review': 'يحتاج مراجعة', Approved: 'معتمد' }
    return `${entryStatus[1]} — ${statuses[entryStatus[2]]}`
  }
  const assigned = /^Assigned to\s+(.+)$/u.exec(text)
  if (assigned) return `مُعيّن إلى ${assigned[1]}`
  const setStatus = /^Set\s+(draft|translated|needs review|approved)$/iu.exec(text)
  if (setStatus) {
    const statuses: Record<string, string> = { draft: 'مسودة', translated: 'مترجم', 'needs review': 'يحتاج مراجعة', approved: 'معتمد' }
    return `تعيين كـ ${statuses[setStatus[1].toLowerCase()]}`
  }
  const autoProfile = /^Auto\s+·\s+(.+)$/u.exec(text)
  if (autoProfile) return `تلقائي · ${autoProfile[1]}`
  const selectedProfile = /^Selected\s+·\s+(.+)$/u.exec(text)
  if (selectedProfile) return `محدد · ${selectedProfile[1]}`
  const detectedProfile = /^Detected\s+(.+)\s+·\s+(\d+)%?\s+confidence$/u.exec(text)
  if (detectedProfile) return `تم اكتشاف ${detectedProfile[1]} · ثقة ${detectedProfile[2]}%`
  const roleUpdated = /^Your role was updated to\s+(.+)\.$/u.exec(text)
  if (roleUpdated) return `تم تحديث صلاحيتك إلى ${roleUpdated[1]}.`
  const opened = /^(.+)\s+opened successfully\.$/u.exec(text)
  if (opened) return `تم فتح ${opened[1]} بنجاح.`
  const unsupportedFormat = /^The\s+\.(.*)\s+format is not currently supported\.$/u.exec(text)
  if (unsupportedFormat) return `صيغة .${unsupportedFormat[1]} غير مدعومة حالياً.`
  const projects = /^(\d+)\s+OF\s+(\d+)\s+PROJECTS$/u.exec(text)
  if (projects) return `${projects[1]} من ${projects[2]} مشاريع`
  const members = /^(\d+)\s+members?$/iu.exec(text)
  if (members) return `${members[1]} عضو`
  const revision = /^Rev\s+(\d+)$/u.exec(text)
  if (revision) return `مراجعة ${revision[1]}`
  const openContent = /^Open\s+(.+)$/u.exec(text)
  if (openContent) return `فتح ${openContent[1]}`
  if (text === 'Verified account') return 'حساب موثّق'
  if (text === '↻ Refresh') return '↻ تحديث'
  if (text.includes('Web Experience Update')) return text.replace('Web Experience Update', 'تحديث تجربة الويب').replace(/^v(?=\d)/u, 'الإصدار ')
  if (text.includes('Local Workspace Parity')) return text.replace('Local Workspace Parity', 'تكافؤ مساحة العمل المحلية').replace(/^v(?=\d)/u, 'الإصدار ')
  if (text.includes('Quiet Polish')) return text.replace('Quiet Polish', 'لمسات هادئة').replace(/^v(?=\d)/u, 'الإصدار ')
  if (text.includes('Web Delight')) return text.replace('Web Delight', 'لمسات تجربة الويب').replace(/^v(?=\d)/u, 'الإصدار ')
  return text
}

export function translateUiText(locale: UiLocale, text: string) {
  if (locale === 'en') return text
  return englishMessageIndex.get(text) ?? dynamicArabicText(text)
}

type I18nContextValue = {
  locale: UiLocale
  direction: 'ltr' | 'rtl'
  setLocale: (locale: UiLocale) => void
  t: (key: MessageKey, values?: MessageValues) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<UiLocale>(readStoredLocale)
  const setLocale = useCallback((nextLocale: UiLocale) => {
    updateLocale(nextLocale)
    try { window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, nextLocale) } catch { /* Preference remains live for this session. */ }
  }, [])
  const t = useCallback((key: MessageKey, values?: MessageValues) => translate(locale, key, values), [locale])
  const originalTexts = useRef(new WeakMap<Text, string>())
  const originalAttributes = useRef(new WeakMap<Element, Map<string, string>>())

  useLayoutEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.dataset.uiLocale = locale
  }, [locale])

  useLayoutEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    const localizedAttributes = ['aria-label', 'aria-description', 'placeholder', 'title'] as const
    const shouldSkip = (node: Node) => node.parentElement?.closest('[data-i18n-skip], [data-i18n-content], code, pre, kbd, samp, [contenteditable="true"]') != null
    const localizeTextNode = (node: Text) => {
      if (shouldSkip(node)) return
      const current = node.data
      const priorOriginal = originalTexts.current.get(node)
      const priorLocalized = priorOriginal == null ? null : translateUiText('ar', priorOriginal.trim())
      if (locale === 'en') {
        // React is allowed to update dynamic English labels (for example
        // Play/Pause or Show/Hide). Only restore a value when it is the
        // Arabic translation left behind by a previous locale.
        if (priorOriginal == null) {
          originalTexts.current.set(node, current)
        } else if (current.trim() === priorLocalized && current !== priorOriginal) {
          node.data = priorOriginal
        } else if (current !== priorOriginal) {
          originalTexts.current.set(node, current)
        }
        return
      }
      let original = priorOriginal
      if (original == null || (current.trim() !== priorLocalized && current !== priorOriginal)) {
        original = current
        originalTexts.current.set(node, original)
      }
      const trimmed = original.trim()
      if (!trimmed) return
      const translated = translateUiText('ar', trimmed)
      if (translated === trimmed) return
      const leading = original.match(/^\s*/u)?.[0] ?? ''
      const trailing = original.match(/\s*$/u)?.[0] ?? ''
      const next = `${leading}${translated}${trailing}`
      if (current !== next) node.data = next
    }
    const localizeElement = (element: Element) => {
      if (element.closest('[data-i18n-skip], [data-i18n-content]')) return
      let originals = originalAttributes.current.get(element)
      if (!originals) {
        originals = new Map()
        originalAttributes.current.set(element, originals)
      }
      for (const attribute of localizedAttributes) {
        const current = element.getAttribute(attribute)
        if (current == null) continue
        const priorOriginal = originals.get(attribute)
        const priorLocalized = priorOriginal == null ? null : translateUiText('ar', priorOriginal)
        if (locale === 'en') {
          if (priorOriginal == null) originals.set(attribute, current)
          else if (current === priorLocalized && current !== priorOriginal) element.setAttribute(attribute, priorOriginal)
          else if (current !== priorOriginal) originals.set(attribute, current)
          continue
        }
        let original = priorOriginal
        if (original == null || (current !== priorLocalized && current !== priorOriginal)) {
          original = current
          originals.set(attribute, original)
        }
        const next = translateUiText('ar', original)
        if (current !== next) element.setAttribute(attribute, next)
      }
    }
    const scan = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node as Text)
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const element = node as Element
      localizeElement(element)
      for (const child of element.childNodes) scan(child)
    }
    scan(root)
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') localizeTextNode(record.target as Text)
        if (record.type === 'attributes') localizeElement(record.target as Element)
        for (const node of record.addedNodes) scan(node)
      }
    })
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...localizedAttributes] })
    return () => observer.disconnect()
  }, [locale])

  const value = useMemo<I18nContextValue>(() => ({ locale, direction: locale === 'ar' ? 'rtl' : 'ltr', setLocale, t }), [locale, setLocale, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider.')
  return value
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()
  return <label className={`lh-language-switcher ${className}`.trim()} data-i18n-skip>
    <span className="lh-visually-hidden">{t('common.language.label')}</span>
    <select aria-label={t('common.language.label')} value={locale} onChange={(event) => setLocale(event.target.value as UiLocale)} dir="ltr">
      <option value="en">English</option>
      <option value="ar">العربية</option>
    </select>
  </label>
}
