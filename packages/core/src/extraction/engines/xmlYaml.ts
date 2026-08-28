/*
 * Cautious XML / YAML structured adapters (extraction only).
 *
 * These are deliberately CONSERVATIVE: they only extract text that is
 * structurally evidenced as player-facing — a known localizable element/field
 * name — never arbitrary text nodes, attributes, or configuration values.
 * Anything they cannot classify precisely is skipped silently rather than
 * guessed.
 */

import { detectEngine } from '../engineDetection'
import type { ExtractedEntry, ExtractionResult } from '../types'
import { buildEntry } from './shared'

/* Element/field names that conventionally carry player-facing text. */
const LOCALIZABLE_KEYS = new Set([
  'string', 'text', 'title', 'description', 'label', 'message', 'content',
  'body', 'subtitle', 'caption', 'name', 'line', 'dialogue', 'spoken',
  'quest', 'objective', 'hint', 'tooltip',
])

function hasNaturalText(value: string): boolean {
  return /[A-Za-z\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF]{2,}/u.test(value.trim())
}

type BuildContext = {
  fileName: string
  entries: ExtractedEntry[]
  order: number
  conversationId: string
}

function pushEntry(ctx: BuildContext, text: string, objectType: string, key?: string): void {
  const trimmed = text.trim()
  if (!trimmed || !hasNaturalText(trimmed)) return
  ctx.entries.push(buildEntry({
    id: `xml:${ctx.fileName}:${ctx.order}`,
    order: ctx.order++,
    sourceText: trimmed,
    key,
    classification: 'UI',
    classificationConfidence: 'medium',
    origin: { engine: 'generic', containerPath: ctx.fileName, objectType, key },
    protectedSegments: [],
    protectionProfile: 'generic',
  }))
}

export function extractXml(fileName: string, text: string): ExtractionResult {
  const ctx: BuildContext = { fileName, entries: [], order: 0, conversationId: `xml:${fileName}` }

  // Match LEAF elements only (content has no nested `<`), so container nodes
  // are skipped and their localizable children are matched individually.
  const elementPattern = /<([A-Za-z_][A-Za-z0-9_.-]*)\b[^>]*>([^<]*)<\/\1\s*>/gu
  let match: RegExpExecArray | null
  while ((match = elementPattern.exec(text)) !== null) {
    const tag = match[1].toLowerCase()
    const inner = match[2]
    if (!LOCALIZABLE_KEYS.has(tag)) continue
    // Unescape common entities.
    const value = inner
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    pushEntry(ctx, value, `xml-${tag}`, tag)
  }

  return {
    engine: 'generic',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries: ctx.entries,
    diagnostics: [],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: ctx.entries.length, byClassification: ctx.entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}), protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 0 },
  }
}

/*
 * Conservative flat-YAML subset: only `key: value` string pairs and `- value`
 * sequence items where the key/item context is localizable. Nested maps/lists
 * are skipped (not guessed). This is NOT a full YAML parser — it is a
 * precision-safe subset for the common TextAsset cases.
 */
export function extractYaml(fileName: string, text: string): ExtractionResult {
  const ctx: BuildContext = { fileName, entries: [], order: 0, conversationId: `yaml:${fileName}` }
  let currentKey: string | undefined

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line.trim()) continue
    if (/^\s*#/.test(line)) continue
    if (/^\s*---/.test(line)) continue

    const indent = line.match(/^\s*/)?.[0].length ?? 0

    // Sequence item: - "value" or - value
    const seqMatch = line.trim().match(/^-\s*(.+)$/u)
    if (seqMatch && indent === 0) {
      const value = unquoteScalar(seqMatch[1])
      if (currentKey && LOCALIZABLE_KEYS.has(currentKey.toLowerCase())) {
        pushEntry(ctx, value, 'yaml-item', currentKey)
      }
      continue
    }

    // key: value pair (flat only).
    const kvMatch = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s*(.*)$/u)
    if (kvMatch) {
      const key = kvMatch[2]
      const raw = kvMatch[3]
      if (raw === '' || raw === '|' || raw === '>') {
        currentKey = key // block scalar start; skip for now (conservative)
        continue
      }
      currentKey = undefined
      if (LOCALIZABLE_KEYS.has(key.toLowerCase())) {
        const value = unquoteScalar(raw)
        pushEntry(ctx, value, `yaml-${key}`, key)
      }
      continue
    }

    // Continuation line under a block scalar we already skipped → ignore.
    currentKey = undefined
  }

  return {
    engine: 'generic',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries: ctx.entries,
    diagnostics: [],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: ctx.entries.length, byClassification: ctx.entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}), protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 0 },
  }
}

function unquoteScalar(value: string): string {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  // Strip a trailing YAML comment.
  return trimmed.replace(/\s+#.*$/u, '').trim()
}
