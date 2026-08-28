import type { LocalizationParseResult, ParsedLocalizationDocument, ParsedLocalizationEntry } from './types'
import { detectDialogueContext, normalizeContextFieldName, type GenericContextMapping } from './contextDetection'

function parseRow(line: string): string[] { const cells: string[] = []; let cell = ''; let quoted = false; for (let i = 0; i < line.length; i += 1) { const char = line[i]; if (char === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i += 1 } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { cells.push(cell); cell = '' } else cell += char } cells.push(cell); return cells }
function rows(text: string): string[][] { const result: string[][] = []; let current = ''; let quoted = false; for (const char of text.replace(/\r\n/g, '\n')) { if (char === '"') quoted = !quoted; if (char === '\n' && !quoted) { result.push(parseRow(current)); current = '' } else current += char } if (current) result.push(parseRow(current)); return result }

/* Strip a leading UTF-8 BOM from the first header cell. */
function stripBomFromRows(data: string[][]): string[][] {
  if (data.length === 0) return data
  const first = data[0]
  if (first.length === 0) return data
  if (first[0].charCodeAt(0) === 0xfeff) {
    const copy = first.slice()
    copy[0] = copy[0].slice(1)
    return [copy, ...data.slice(1)]
  }
  return data
}

export function parseCsvLocalization(text: string, mappings?: GenericContextMapping[]): LocalizationParseResult {
  const data = stripBomFromRows(rows(text))
  if (data.length < 2) return { ok: false, reason: 'CSV must contain a header and at least one row.' }
  const header = data[0].map((value) => value.trim())
  const normalizedHeader = header.map((value) => normalizeContextFieldName(value))
  const indexOf = (name: string) => normalizedHeader.indexOf(name)
  const firstIndexOf = (names: string[]) => { for (const n of names) { const i = indexOf(n); if (i >= 0) return i } return -1 }

  // User-provided source/key/translation mappings (from the Context Mapping
  // review) override heuristic column detection, e.g. `body` → sourceText.
  const mappingByField = new Map<string, string>()
  for (const m of mappings ?? []) mappingByField.set(m.field.trim(), m.role)

  let keyIndex = -1
  let sourceIndex = -1
  let translationIndex = -1
  header.forEach((name, i) => {
    const mapped = mappingByField.get(name)
    if (mapped === 'key') keyIndex = i
    else if (mapped === 'sourceText') sourceIndex = i
  })

  if (sourceIndex < 0) sourceIndex = firstIndexOf(['source', 'text', 'value', 'message', 'line', 'content', 'original', 'en', 'english', 'source_text'])
  if (keyIndex < 0) keyIndex = firstIndexOf(['key', 'id', 'entry_id', 'line_id', 'string_key', 'name'])
  translationIndex = firstIndexOf(['translation', 'target', 'translated', 'target_text', 'ar', 'text_ar'])

  if (sourceIndex < 0) return { ok: false, reason: 'CSV requires a source/text column.' }

  const dataRows = data.slice(1).filter((row) => row.length > sourceIndex)
  if (!dataRows.length) return { ok: false, reason: 'CSV contains no entries.' }

  // Build a record per row keyed by the ORIGINAL header name, so explicit
  // speaker/listener/gender/context columns are detected by name.
  const entries: ParsedLocalizationEntry[] = dataRows.map((row, index) => {
    const record: Record<string, unknown> = {}
    header.forEach((name, i) => { record[name] = row[i] ?? '' })
    const dialogueContext = detectDialogueContext(record, undefined, mappings)
    return {
      id: `csv:${index}:${keyIndex >= 0 ? row[keyIndex] ?? '' : index}`,
      key: keyIndex >= 0 ? row[keyIndex] ?? '' : String(index),
      source: row[sourceIndex] ?? '',
      translation: translationIndex >= 0 ? row[translationIndex] ?? '' : '',
      dialogueContext,
      keyPath: keyIndex >= 0 ? [row[keyIndex] ?? ''] : [String(index)],
      sourcePath: [row[sourceIndex] ?? ''],
    }
  })

  const document: ParsedLocalizationDocument = { parser: 'csv', format: 'csv', sourceText: text, entries }
  return { ok: true, document }
}

export function exportCsvLocalization(document: ParsedLocalizationDocument): string { const quote = (value: string) => `"${value.replace(/"/g, '""')}"`; return ['key,source,translation', ...document.entries.map((entry) => [entry.key, entry.source, entry.translation].map(quote).join(','))].join('\n') + '\n' }
