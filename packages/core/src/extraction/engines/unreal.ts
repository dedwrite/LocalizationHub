/*
 * Unreal Engine adapter (extraction only).
 *
 * Natively parsed surfaces:
 *   - `.locres` (optimized v2) via the dedicated reader
 *   - Unreal String Table CSV (key, source string, comment columns)
 *   - FText / DialogueWave structured JSON (from UAssetDumper/UAssetAPI dumps)
 *
 * `.pak` / `.utoc` / `.ucas` / loose `.uasset` binary parsing is delegated to
 * external tooling (repak / retoc / UAssetDumper) via the desktop adapter.
 * Encrypted containers are detected and reported; keys are never brute-forced.
 */

import { extractUnrealTokens } from '../../tokens/unreal'
import { detectEngine } from '../engineDetection'
import { analyzeRecord, structuralEntryId, walkStructuredData } from '../structuredData'
import type {
  ExtractedEntry,
  ExtractionDiagnostic,
  ExtractionResult,
  SourceLocator,
} from '../types'
import { EXCLUDED_AUDIENCES } from '../types'
import { buildEntry, toProtectedSegments } from './shared'
import { readLocres } from './locres'
import { readLocmeta } from './locmeta'
import { classifyUnrealLocresAudience } from '../unrealAudience'

type UnrealTextInput = {
  fileName: string
  text: string
  mappings?: Array<{ fieldName: string; role: any }>
}

type UnrealBufferInput = {
  fileName: string
  buffer: Uint8Array
}

function emptyResult(engine: 'unreal', fileName: string, diagnostics: ExtractionDiagnostic[], entries: ExtractedEntry[] = []): ExtractionResult {
  return {
    engine,
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics,
    stats: {
      filesScanned: 1,
      candidateFiles: 1,
      entriesFound: entries.length,
      byClassification: entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}),
      protectedTokenCount: entries.reduce((sum, e) => sum + e.protectedSegments.length, 0),
      entriesWithSpeaker: entries.filter((e) => e.context?.speaker).length,
      entriesWithListener: entries.filter((e) => e.context?.listener || e.context?.listeners?.length).length,
      entriesWithExplicitGender: entries.filter((e) => e.context?.speakerGender && e.context.speakerGender !== 'unknown').length,
      entriesWithInferredContext: entries.filter((e) => e.context?.speaker || e.context?.scene || e.context?.conversationId).length,
      conversationGroups: 0,
      warnings: diagnostics.filter((d) => d.kind === 'partial-extraction' || d.kind === 'low-confidence').length,
      errors: diagnostics.filter((d) => d.kind !== 'partial-extraction' && d.kind !== 'low-confidence').length,
    },
  }
}

function parseCsvRows(text: string): string[][] {
  const result: string[][] = []
  let current = ''
  let quoted = false
  for (const char of text.replace(/\r\n/g, '\n')) {
    if (char === '"') quoted = !quoted
    if (char === '\n' && !quoted) { result.push(parseCsvRow(current)); current = '' } else { current += char }
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
    if (char === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i += 1 }
    else if (char === '"') { quoted = !quoted }
    else if (char === ',' && !quoted) { cells.push(cell); cell = '' }
    else { cell += char }
  }
  cells.push(cell)
  return cells
}

/*
 * Unreal String Table CSV. Format: header row with "Key" then source-language
 * columns; additional columns may be comment columns (start with "_") or other
 * locales. Key identity and namespace are preserved, never translated.
 */
function extractUnrealStringTable(fileName: string, text: string): ExtractionResult {
  const rows = parseCsvRows(text)
  if (rows.length < 2) {
    return emptyResult('unreal', fileName, [{ kind: 'corrupt-resource', message: 'Unreal String Table CSV requires a header and data row.', path: fileName }])
  }

  const header = rows[0].map((v) => v.trim())
  const keyIndex = header.findIndex((v) => /^key$/iu.test(v))
  if (keyIndex < 0) {
    return emptyResult('unreal', fileName, [{ kind: 'unsupported-format', message: 'Unreal String Table CSV is missing a Key column.', path: fileName }])
  }

  // Source language is the first non-key, non-comment column.
  const sourceIndex = header.findIndex((v, i) => i !== keyIndex && v && !v.startsWith('_'))
  if (sourceIndex < 0) {
    return emptyResult('unreal', fileName, [{ kind: 'unsupported-format', message: 'Unreal String Table CSV has no source-language column.', path: fileName }])
  }

  const sourceLocale = header[sourceIndex]
  const entries: ExtractedEntry[] = []
  let order = 0

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (row.length === 0) continue
    const key = row[keyIndex]?.trim()
    if (!key) continue
    const sourceText = row[sourceIndex] ?? ''
    if (!sourceText || !sourceText.trim()) continue

    const origin: SourceLocator = {
      engine: 'unreal',
      containerPath: fileName,
      table: 'StringTable',
      row: String(rowIndex),
      key,
    }

    entries.push(buildEntry({
      id: structuralEntryId(['unreal-stringtable', key]),
      key,
      order: order++,
      sourceText,
      sourceLocale,
      classification: 'UI',
      classificationConfidence: 'high',
      origin,
      protectedSegments: toProtectedSegments(extractUnrealTokens(sourceText)),
      protectionProfile: 'unreal',
    }))
  }

  return emptyResult('unreal', fileName, [], entries)
}

/*
 * Structured FText / DialogueWave JSON (from UAssetDumper/UAssetAPI). Uses the
 * shared structured analyzer so speaker/listener/gender/context fields are
 * extracted with provenance. DialogueWave properties like SpokenText,
 * SubtitleOverride, and VoiceActorDirection are recognized via context aliases.
 */
function extractUnrealStructuredJson(fileName: string, text: string, mappings: Array<{ fieldName: string; role: any }>): ExtractionResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return emptyResult('unreal', fileName, [{ kind: 'corrupt-resource', message: 'Unreal asset JSON is not valid JSON.', path: fileName }])
  }

  const entries: ExtractedEntry[] = []
  const order = { value: 0 }

  const extract = (record: Record<string, unknown>, path: string[]) => {
    const result = analyzeRecord(
      { record, path, order: order.value },
      {
        engine: 'unreal',
        mappings,
        containerPath: fileName,
        protectionProfile: 'unreal',
        extractProtectedSegments: extractUnrealTokens,
        forceTranslatableFields: ['SpokenText', 'SubtitleOverride', 'text', 'SourceString', 'DisplayText', 'ToolTipText'],
        neverTranslatableFields: ['Namespace', 'Key', 'id', 'Guid', 'package', 'path', 'ObjectName', 'ExportType'],
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
      mappings,
    })
  }

  return emptyResult('unreal', fileName, [], entries)
}

export function extractUnrealText(input: UnrealTextInput): ExtractionResult {
  const extension = input.fileName.split('.').pop()?.toLowerCase()
  if (extension === 'csv') return extractUnrealStringTable(input.fileName, input.text)
  if (extension === 'json') return extractUnrealStructuredJson(input.fileName, input.text, input.mappings ?? [])
  return emptyResult('unreal', input.fileName, [{ kind: 'unsupported-format', message: `Unreal ${extension} requires the binary asset pipeline.`, path: input.fileName }])
}

export function extractUnrealLocres(input: UnrealBufferInput): ExtractionResult {
  const result = readLocres(input.buffer, { containerPath: input.fileName })
  // Audience precision: engine/plugin stock (Unreal Editor, Niagara, MetaSound,
  // marketplace plugins) and test markers are auto-excluded from the default
  // project; game-authored runtime content stays included.
  const entries = result.entries.map((entry) => {
    const audience = classifyUnrealLocresAudience(input.fileName, entry.namespace, entry.key)
    if (audience.audience === 'runtime') return entry
    return {
      ...entry,
      contentAudience: audience.audience,
      exclusionReason: audience.reason,
      excludedByDefault: EXCLUDED_AUDIENCES.has(audience.audience),
    }
  })
  return emptyResult('unreal', input.fileName, result.diagnostics, entries)
}

/*
 * LOCMETA is metadata only (native culture, compiled cultures); it never
 * produces translatable entries. Diagnostics are informational.
 */
export function extractUnrealLocmeta(input: UnrealBufferInput): ExtractionResult {
  const meta = readLocmeta(input.buffer)
  if (meta.error) {
    return emptyResult('unreal', input.fileName, [{ kind: 'corrupt-resource', message: meta.error, path: input.fileName }])
  }
  return emptyResult('unreal', input.fileName, [])
}

export function detectEncryptedUnrealContainer(fileName: string, buffer: Uint8Array): ExtractionDiagnostic | undefined {
  // A .pak/.utoc/.ucas with an unknown/unsupported header is reported as
  // encrypted-or-unsupported rather than scanned. We never attempt decryption.
  if (!/\.(pak|utoc|ucas)$/iu.test(fileName)) return undefined
  const firstBytes = buffer.length >= 4
    ? Array.from(buffer.subarray(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join(' ')
    : ''
  return {
    kind: 'unsupported-format',
    message: `Unreal archive ${fileName} (header ${firstBytes}) requires external unpacking; if encrypted, provide the AES key to the adapter.`,
    path: fileName,
  }
}
