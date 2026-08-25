import { describe, expect, it } from 'vitest'
import { parseLocalizationFile } from './index'
import { exportLocalizationDocument } from '../exporters'

describe('CSV and PO formats', () => {
  it('round trips quoted CSV fields and Arabic', () => { const parsed = parseLocalizationFile('key,source,translation\n"menu","Open, now","افتح\nالآن"\n', 'strings.csv'); expect(parsed.ok).toBe(true); if (parsed.ok) { const output = exportLocalizationDocument(parsed.document); expect(output).toContain('"Open, now"'); expect(output).toContain('"افتح\nالآن"') } })
  it('round trips PO context and Arabic', () => { const parsed = parseLocalizationFile('翻訳者コメント\nmsgctxt "menu"\nmsgid "Open"\nmsgstr "فتح"\n', 'strings.po'); expect(parsed.ok).toBe(true); if (parsed.ok) { const output = exportLocalizationDocument(parsed.document); expect(output).toContain('msgctxt "menu"'); expect(output).toContain('msgstr "فتح"') } })
  it('parses and exports PO multiline fields and comments', () => { const parsed = parseLocalizationFile('#: menu.json:1\nmsgid "Open \\\"now\\\""\n "menu"\nmsgstr "افتح "\n "الآن"\n', 'strings.po'); expect(parsed.ok).toBe(true); if (parsed.ok) { expect(parsed.document.entries[0].source).toBe('Open "now"menu'); expect(parsed.document.entries[0].translation).toBe('افتح الآن'); expect(exportLocalizationDocument(parsed.document)).toContain('#: menu.json:1') } })
})
