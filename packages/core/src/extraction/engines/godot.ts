/*
 * Godot engine adapter (extraction only).
 *
 * Supports the text-based Godot localization surfaces that can be parsed
 * reliably in TypeScript:
 *   - Godot CSV localization (first column = keys, locale columns, "_" comments)
 *   - Gettext PO
 *   - Godot .translation (binary) — partial: recognized but delegated to tooling
 *   - Godot .tscn / .tres text resources (user-facing text properties only)
 *   - Custom structured dialogue JSON (via the shared structured-data analyzer)
 *
 * Binary .pck / .res / .scn extraction is delegated to external tooling
 * (e.g. gdsdecomp / repak-class) via the desktop external-tool adapter, never
 * via printable-string scanning.
 */

import { extractGodotTokens } from '../../tokens/godot'
import { detectEngine } from '../engineDetection'
import { analyzeRecord, structuralEntryId, walkStructuredData } from '../structuredData'
import type {
  EngineFamily,
  ExtractedEntry,
  ExtractionDiagnostic,
  ExtractionResult,
  SourceLocator,
} from '../types'
import { buildEntry, toProtectedSegments } from './shared'

type GodotInput = {
  fileName: string
  text: string
  mappings?: Array<{ fieldName: string; role: any }>
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

function extractGodotCsv(fileName: string, text: string): ExtractionResult {
  const rows = parseCsvRows(text)
  const diagnostics: ExtractionDiagnostic[] = []

  if (rows.length < 2) {
    return {
      engine: 'godot',
      detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
      entries: [],
      diagnostics: [{ kind: 'corrupt-resource', message: 'Godot CSV requires a header row and at least one data row.', path: fileName }],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
    }
  }

  const header = rows[0]
  // First column is the key column; remaining columns are locales or "_" comments.
  const localeColumns: Array<{ index: number; name: string }> = []
  for (let i = 1; i < header.length; i += 1) {
    const name = header[i].trim()
    if (!name) continue
    if (name.startsWith('_')) continue // comment column
    localeColumns.push({ index: i, name })
  }

  if (localeColumns.length === 0) {
    diagnostics.push({ kind: 'partial-extraction', message: 'Godot CSV has no locale columns.', path: fileName })
  }

  const sourceLocale = localeColumns[0]?.name

  const entries: ExtractedEntry[] = []
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (row.length === 0) continue
    const key = row[0]?.trim()
    if (!key) continue

    // Source text is the first non-comment locale column; translations follow.
    const sourceText = localeColumns[0] ? (row[localeColumns[0].index] ?? '') : ''
    if (!sourceText || !sourceText.trim()) continue

    const pluralVariants: Array<{ quantity: string; text: string }> = []
    const existingTranslations: string[] = []

    for (let i = 1; i < localeColumns.length; i += 1) {
      const { index, name } = localeColumns[i]
      const value = row[index] ?? ''
      if (!value) continue
      if (/^(one|other|zero|two|few|many)$/u.test(name)) {
        pluralVariants.push({ quantity: name, text: value })
      } else {
        existingTranslations.push(value)
      }
    }

    const origin: SourceLocator = {
      engine: 'godot' as EngineFamily,
      containerPath: fileName,
      table: 'csv-localization',
      row: String(rowIndex),
      key,
    }

    entries.push(buildEntry({
      id: structuralEntryId(['godot-csv', key]),
      key,
      order: rowIndex,
      sourceText,
      sourceLocale,
      existingTranslation: existingTranslations[0],
      pluralVariants: pluralVariants.length > 0 ? pluralVariants : undefined,
      classification: 'UI',
      classificationConfidence: 'medium',
      origin,
      protectedSegments: toProtectedSegments(extractGodotTokens(sourceText)),
      protectionProfile: 'godot',
      rawMetadata: { locales: localeColumns.map((c) => c.name) },
    }))
  }

  return {
    engine: 'godot',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics,
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: entries.length, byClassification: { UI: entries.length }, protectedTokenCount: entries.reduce((sum, e) => sum + e.protectedSegments.length, 0), entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: diagnostics.length, errors: 0 },
  }
}

const USER_FACING_PROPERTIES = new Set([
  'text',
  'tooltip_text',
  'placeholder_text',
  'title',
  'description',
  'hint',
  'dialogue',
  'line',
  'subtitle',
])

const STRUCTURAL_PROPERTIES = new Set([
  'path',
  'uid',
  'id',
  'script',
  'texture',
  'font',
  'icon',
  'resource',
  'next_scene',
])

function extractGodotScene(fileName: string, text: string): ExtractionResult {
  const diagnostics: ExtractionDiagnostic[] = []
  const entries: ExtractedEntry[] = []
  let currentSection = ''
  let order = 0

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  for (const line of lines) {
    const sectionMatch = line.match(/^\[([^\]]+)\]/u)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      continue
    }

    // Only parse inside [node] sections (actual scene content).
    if (!currentSection.startsWith('node')) continue

    const assignment = line.match(/^(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/u)
    if (!assignment) continue

    const property = assignment[1]
    const rawValue = assignment[2]
    // Unescape Godot string escapes (\n, \", \t).
    const value = rawValue
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')

    if (!USER_FACING_PROPERTIES.has(property)) continue
    if (STRUCTURAL_PROPERTIES.has(property)) continue
    if (/^(res|uid):\/\//u.test(value)) continue
    if (!value.trim()) continue

    entries.push(buildEntry({
      id: structuralEntryId(['godot-scene', fileName, String(order)]),
      order: order++,
      sourceText: value,
      classification: property === 'text' ? 'UI' : 'UI',
      classificationConfidence: 'medium',
      origin: {
        engine: 'godot',
        containerPath: fileName,
        fieldPath: property,
        objectType: currentSection,
      },
      protectedSegments: toProtectedSegments(extractGodotTokens(value)),
      protectionProfile: 'godot',
      rawMetadata: { property, node: currentSection },
    }))
  }

  return {
    engine: 'godot',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics,
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: entries.length, byClassification: { UI: entries.length }, protectedTokenCount: entries.reduce((sum, e) => sum + e.protectedSegments.length, 0), entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 0 },
  }
}

function extractGodotStructuredJson(fileName: string, text: string, mappings: Array<{ fieldName: string; role: any }>): ExtractionResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      engine: 'godot',
      detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
      entries: [],
      diagnostics: [{ kind: 'corrupt-resource', message: 'Dialogue JSON is not valid JSON.', path: fileName }],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
    }
  }

  const entries: ExtractedEntry[] = []
  const order = { value: 0 }

  const extract = (record: Record<string, unknown>, path: string[]) => {
    const result = analyzeRecord(
      { record, path, order: order.value },
      {
        engine: 'godot',
        mappings,
        containerPath: fileName,
        protectionProfile: 'godot',
        extractProtectedSegments: extractGodotTokens,
        forceTranslatableFields: ['text', 'message', 'line', 'content', 'subtitle', 'spokenText', 'displayText'],
        neverTranslatableFields: ['id', 'key', 'uid', 'path', 'type', 'locale'],
      },
    )
    order.value += 1
    for (const entry of result.entries) {
      entries.push({
        ...entry,
        order: entries.length,
      })
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
    engine: 'godot',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics: [],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: entries.length, byClassification: entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}), protectedTokenCount: entries.reduce((sum, e) => sum + e.protectedSegments.length, 0), entriesWithSpeaker: entries.filter((e) => e.context?.speaker).length, entriesWithListener: entries.filter((e) => e.context?.listener || e.context?.listeners?.length).length, entriesWithExplicitGender: entries.filter((e) => e.context?.speakerGender && e.context.speakerGender !== 'unknown').length, entriesWithInferredContext: entries.filter((e) => e.context?.speaker || e.context?.scene || e.context?.conversationId).length, conversationGroups: 0, warnings: 0, errors: 0 },
  }
}

export function extractGodot(input: GodotInput): ExtractionResult {
  const extension = input.fileName.split('.').pop()?.toLowerCase()
  const lower = input.fileName.toLowerCase()

  if (extension === 'csv') return extractGodotCsv(input.fileName, input.text)
  if (extension === 'po' || extension === 'pot') return extractGodotCsv(input.fileName, input.text)
  if (extension === 'tscn' || extension === 'scn' || extension === 'tres') return extractGodotScene(input.fileName, input.text)
  if (extension === 'json' || lower.includes('dialogue')) return extractGodotStructuredJson(input.fileName, input.text, input.mappings ?? [])

  // Binary .translation / .res / .scn are delegated to external tooling.
  return {
    engine: 'godot',
    detection: detectEngine({ files: [{ name: input.fileName, lower }], directories: [] }),
    entries: [],
    diagnostics: [{ kind: 'unsupported-format', message: `Godot ${extension ?? 'binary'} extraction requires external tooling.`, path: input.fileName }],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
  }
}
