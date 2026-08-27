/*
 * Unity engine adapter (EXTRACTION ONLY).
 *
 * Unity serialized-asset injection is explicitly out of scope. This adapter
 * reads only the structured text surfaces that can be safely parsed:
 *   - TextAsset JSON / CSV (dialogue datasets, custom formats)
 *   - Unity Localization package String Table JSON
 *   - Ink narrative JSON
 *   - Smart Strings (protection of nested selectors/placeholders)
 *
 * Binary SerializedFile / AssetBundle parsing is delegated to external tooling
 * (UnityPy / AssetStudio-class) via the desktop external-tool adapter, never
 * printable-string scanning.
 */

import { extractUnityTokens } from '../../tokens/unity'
import { detectEngine } from '../engineDetection'
import { analyzeRecord, structuralEntryId, walkStructuredData } from '../structuredData'
import type {
  ExtractedEntry,
  ExtractionResult,
  SourceLocator,
} from '../types'
import { buildEntry, toProtectedSegments } from './shared'

type UnityInput = {
  fileName: string
  text: string
  mappings?: Array<{ fieldName: string; role: any }>
}

/*
 * Unity Localization package String Table JSON shape:
 * {
 *   "Locale": { "Identifier": { "Code": "en", "Name": "English" } },
 *   "Table": { "en": { "entry-key": "Translated value", ... } },
 *   "EntryKeys": { ... metadata ... }
 * }
 */
function extractUnityStringTable(fileName: string, text: string): ExtractionResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      engine: 'unity',
      detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
      entries: [],
      diagnostics: [{ kind: 'corrupt-resource', message: 'String Table JSON is not valid JSON.', path: fileName }],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      engine: 'unity',
      detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
      entries: [],
      diagnostics: [{ kind: 'unsupported-format', message: 'String Table JSON has an unexpected shape.', path: fileName }],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
    }
  }

  const obj = parsed as Record<string, unknown>
  const table = obj['Table'] as Record<string, Record<string, string>> | undefined
  if (!table) {
    return {
      engine: 'unity',
      detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
      entries: [],
      diagnostics: [{ kind: 'unsupported-format', message: 'String Table JSON is missing a Table object.', path: fileName }],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
    }
  }

  const entries: ExtractedEntry[] = []
  let order = 0

  // The first locale is treated as the source locale.
  const locales = Object.keys(table)
  const sourceLocale = locales[0]

  // Collect every key across locales.
  const allKeys = new Set<string>()
  for (const localeEntries of Object.values(table)) {
    for (const key of Object.keys(localeEntries)) allKeys.add(key)
  }

  for (const key of allKeys) {
    const sourceText = table[sourceLocale]?.[key] ?? ''
    if (!sourceText || !sourceText.trim()) continue

    const existingTranslation = locales.slice(1)
      .map((locale) => table[locale]?.[key])
      .find((value) => value && value.trim()) ?? undefined

    const origin: SourceLocator = {
      engine: 'unity',
      containerPath: fileName,
      table: 'StringTable',
      key,
    }

    entries.push(buildEntry({
      id: structuralEntryId(['unity-stringtable', key]),
      key,
      order: order++,
      sourceText,
      sourceLocale,
      existingTranslation,
      classification: 'UI',
      classificationConfidence: 'high',
      origin,
      protectedSegments: toProtectedSegments(extractUnityTokens(sourceText)),
      protectionProfile: 'unity',
      rawMetadata: { smartString: true, locales },
    }))
  }

  return {
    engine: 'unity',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics: [],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: entries.length, byClassification: { UI: entries.length }, protectedTokenCount: entries.reduce((sum, e) => sum + e.protectedSegments.length, 0), entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 0 },
  }
}

function extractUnityStructuredJson(fileName: string, text: string, mappings: Array<{ fieldName: string; role: any }>): ExtractionResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      engine: 'unity',
      detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
      entries: [],
      diagnostics: [{ kind: 'corrupt-resource', message: 'TextAsset JSON is not valid JSON.', path: fileName }],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
    }
  }

  const entries: ExtractedEntry[] = []
  const order = { value: 0 }

  const extract = (record: Record<string, unknown>, path: string[]) => {
    const result = analyzeRecord(
      { record, path, order: order.value },
      {
        engine: 'unity',
        mappings,
        containerPath: fileName,
        protectionProfile: 'unity',
        extractProtectedSegments: extractUnityTokens,
        forceTranslatableFields: ['text', 'message', 'line', 'content', 'subtitle', 'spokenText', 'displayText', 'value'],
        neverTranslatableFields: ['id', 'key', 'guid', 'fileID', 'pathID', 'type', 'locale', 'path'],
      },
    )
    order.value += 1
    for (const entry of result.entries) {
      entries.push({ ...entry, order: entries.length })
    }
  }

  if (Array.isArray(parsed)) {
    parsed.forEach((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        extract(item as Record<string, unknown>, [String(index)])
      }
    })
  } else if (parsed && typeof parsed === 'object') {
    walkStructuredData(parsed, {
      onRecord: (record) => extract(record.record, record.path),
      order,
    })
  }

  return {
    engine: 'unity',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics: [],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: entries.length, byClassification: entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}), protectedTokenCount: entries.reduce((sum, e) => sum + e.protectedSegments.length, 0), entriesWithSpeaker: entries.filter((e) => e.context?.speaker).length, entriesWithListener: entries.filter((e) => e.context?.listener || e.context?.listeners?.length).length, entriesWithExplicitGender: entries.filter((e) => e.context?.speakerGender && e.context.speakerGender !== 'unknown').length, entriesWithInferredContext: entries.filter((e) => e.context?.speaker || e.context?.scene || e.context?.conversationId).length, conversationGroups: 0, warnings: 0, errors: 0 },
  }
}

export function extractUnity(input: UnityInput): ExtractionResult {
  const lower = input.fileName.toLowerCase()
  const extension = input.fileName.split('.').pop()?.toLowerCase()

  // Unity Localization String Table JSON (has a "Table" + "Locale" object).
  if (extension === 'json') {
    let parsed: unknown
    try {
      parsed = JSON.parse(input.text)
    } catch {
      return {
        engine: 'unity',
        detection: detectEngine({ files: [{ name: input.fileName, lower }], directories: [] }),
        entries: [],
        diagnostics: [{ kind: 'corrupt-resource', message: 'JSON is not valid JSON.', path: input.fileName }],
        stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
      }
    }
    if (parsed && typeof parsed === 'object' && ('Table' in (parsed as object) || 'SharedTableData' in (parsed as object))) {
      return extractUnityStringTable(input.fileName, input.text)
    }
    return extractUnityStructuredJson(input.fileName, input.text, input.mappings ?? [])
  }

  if (extension === 'csv') {
    // TextAsset CSV uses the generic structured analyzer via the Godot-style
    // path is not appropriate; treat CSV as structured rows with header mapping.
    return extractUnityStructuredJson(input.fileName, csvToJsonArray(input.text), input.mappings ?? [])
  }

  return {
    engine: 'unity',
    detection: detectEngine({ files: [{ name: input.fileName, lower }], directories: [] }),
    entries: [],
    diagnostics: [{ kind: 'unsupported-format', message: `Unity ${extension ?? 'binary'} requires external tooling (UnityPy / AssetStudio).`, path: input.fileName }],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
  }
}

function csvToJsonArray(text: string): string {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return '[]'
  const header = rows[0]
  const objects = rows.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    header.forEach((name, index) => {
      obj[name.trim()] = row[index] ?? ''
    })
    return obj
  })
  return JSON.stringify(objects)
}

function parseCsvRows(text: string): string[][] {
  const result: string[][] = []
  let current = ''
  let quoted = false
  for (const char of text.replace(/\r\n/g, '\n')) {
    if (char === '"') quoted = !quoted
    if (char === '\n' && !quoted) {
      result.push(parseCsvRow(current))
      current = ''
    } else {
      current += char
    }
  }
  if (current) result.push(parseCsvRow(current))
  return result
}

function parseCsvRow(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"' && line[i + 1] === '"' && quoted) {
      cell += '"'
      i += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells
}

export { extractUnityStringTable, extractUnityStructuredJson }
