/*
 * Gettext PO / POT parser.
 *
 * A real PO parser (not a CSV shim). Supports:
 *   - msgid / msgstr
 *   - msgctxt (disambiguating context)
 *   - msgid_plural + msgstr[n] (plural forms)
 *   - translator comments (#, #., #:) — surfaced as developerNote / reference
 *   - escaped multi-line strings (double-quoted with \n, \t, \", \\)
 *
 * Produces normalized ExtractedEntry objects with plural variants and context,
 * never a flat dump of every string.
 */

import { detectEngine } from '../engineDetection'
import { structuralEntryId } from '../structuredData'
import type {
  ExtractedEntry,
  ExtractionResult,
  SourceLocator,
} from '../types'
import { buildEntry } from './shared'

type PoMessage = {
  msgctxt?: string
  msgid: string
  msgidPlural?: string
  msgstr: string[]
  comments: string[]
  references: string[]
}

/*
 * Parse a PO file into messages. Handles the standard gettext grammar:
 * keyword directives (`msgid`, `msgstr`, `msgctxt`, `msgid_plural`,
 * `msgstr[n]`), comment lines (`#`), and continuation strings.
 */
export function parsePo(text: string): PoMessage[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const messages: PoMessage[] = []
  let current: PoMessage | null = null
  let pendingComments: string[] = []
  let pendingReferences: string[] = []
  let currentKey: string | null = null

  const flush = () => {
    if (current && current.msgid.length > 0) {
      current.comments = pendingComments
      current.references = pendingReferences
      messages.push(current)
    }
    current = null
    pendingComments = []
    pendingReferences = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Comment lines accumulate until the next keyword.
    if (line.startsWith('#:')) {
      pendingReferences.push(line.slice(2).trim())
      continue
    }
    if (line.startsWith('#')) {
      pendingComments.push(line.slice(1).trim())
      continue
    }
    if (line === '') {
      flush()
      continue
    }

    // Keyword directive, e.g. `msgid "..."`, `msgstr[0] "..."`.
    const keywordMatch = line.match(/^(msgid_plural|msgstr\[\d+\]|msgid|msgstr|msgctxt)\s+(.*)$/u)
    if (keywordMatch) {
      const keyword = keywordMatch[1]
      const rest = keywordMatch[2]
      const value = unescapePoString(rest)

      if (keyword === 'msgid') {
        if (current && current.msgid.length > 0) flush()
        if (!current) current = { msgid: '', msgstr: [], comments: [], references: [] }
        current.msgid = value
        currentKey = 'msgid'
      } else if (keyword === 'msgctxt') {
        if (!current) current = { msgid: '', msgstr: [], comments: [], references: [] }
        current.msgctxt = value
        currentKey = 'msgctxt'
      } else if (keyword === 'msgid_plural') {
        if (!current) current = { msgid: '', msgstr: [], comments: [], references: [] }
        current.msgidPlural = value
        currentKey = 'msgid_plural'
      } else if (keyword === 'msgstr' || keyword.startsWith('msgstr[')) {
        if (!current) current = { msgid: '', msgstr: [], comments: [], references: [] }
        const indexMatch = keyword.match(/^msgstr\[(\d+)\]$/u)
        const index = indexMatch ? Number(indexMatch[1]) : 0
        current.msgstr[index] = value
        currentKey = keyword
      }
      continue
    }

    // Continuation string (a quoted line with no keyword).
    if (current && currentKey && line.startsWith('"')) {
      const value = unescapePoString(line)
      if (currentKey === 'msgid') current.msgid += value
      else if (currentKey === 'msgctxt') current.msgctxt = (current.msgctxt ?? '') + value
      else if (currentKey === 'msgid_plural') current.msgidPlural = (current.msgidPlural ?? '') + value
      else if (currentKey === 'msgstr') current.msgstr[0] = (current.msgstr[0] ?? '') + value
      else if (currentKey.startsWith('msgstr[')) {
        const indexMatch = currentKey.match(/^msgstr\[(\d+)\]$/u)
        const index = indexMatch ? Number(indexMatch[1]) : 0
        current.msgstr[index] = (current.msgstr[index] ?? '') + value
      }
    }
  }
  flush()

  return messages
}

function unescapePoString(raw: string): string {
  // A PO string is a sequence of double-quoted segments concatenated. This
  // function handles a single line that may contain one or more quoted parts.
  let out = ''
  let i = 0
  while (i < raw.length) {
    if (raw[i] === '"') {
      i += 1
      let segment = ''
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === '\\' && i + 1 < raw.length) {
          const next = raw[i + 1]
          switch (next) {
            case 'n': segment += '\n'; break
            case 't': segment += '\t'; break
            case 'r': segment += '\r'; break
            case '"': segment += '"'; break
            case '\\': segment += '\\'; break
            default: segment += next; break
          }
          i += 2
        } else {
          segment += raw[i]
          i += 1
        }
      }
      out += segment
      i += 1 // skip closing quote
    } else {
      i += 1
    }
  }
  return out
}

/*
 * Convert parsed PO messages into normalized entries. The source locale is
 * derived from the plural form count or defaults to the first msgstr.
 */
export function extractPo(fileName: string, text: string): ExtractionResult {
  let messages: PoMessage[]
  try {
    messages = parsePo(text)
  } catch (error) {
    return {
      engine: 'godot',
      detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
      entries: [],
      diagnostics: [{ kind: 'corrupt-resource', message: error instanceof Error ? error.message : 'PO parse failed.', path: fileName }],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
    }
  }

  const entries: ExtractedEntry[] = []
  let order = 0
  let missingTranslations = 0

  for (const message of messages) {
    const sourceText = message.msgid
    const hasPlural = Boolean(message.msgidPlural)

    const pluralVariants: Array<{ quantity: string; text: string }> = []
    if (hasPlural) {
      // Godot PO plural indexes: 0=singular, 1=plural.
      const singular = message.msgstr[0] ?? ''
      const plural = message.msgstr[1] ?? ''
      if (singular) pluralVariants.push({ quantity: 'one', text: singular })
      if (plural) pluralVariants.push({ quantity: 'other', text: plural })
    }

    const firstTranslation = message.msgstr.find((v) => v && v.trim())
    if (!firstTranslation) missingTranslations += 1

    const origin: SourceLocator = {
      engine: 'godot',
      containerPath: fileName,
      table: 'gettext',
      key: message.msgctxt ? `${message.msgctxt}\u0004${message.msgid}` : message.msgid,
    }

    entries.push(buildEntry({
      id: structuralEntryId(['godot-po', message.msgctxt ?? '', message.msgid]),
      key: message.msgid,
      order: order++,
      sourceText,
      existingTranslation: firstTranslation,
      pluralVariants: pluralVariants.length > 0 ? pluralVariants : undefined,
      classification: hasPlural ? 'Dialogue' : 'UI',
      classificationConfidence: 'medium',
      context: {
        developerNote: message.comments.length > 0 ? message.comments.join('\n') : undefined,
        contextText: message.msgctxt,
      },
      origin,
      protectedSegments: [],
      protectionProfile: 'godot',
      rawMetadata: {
        msgctxt: message.msgctxt,
        references: message.references,
        plural: hasPlural,
      },
    }))
  }

  return {
    engine: 'godot',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics: [],
    stats: {
      filesScanned: 1,
      candidateFiles: 1,
      entriesFound: entries.length,
      byClassification: entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}),
      protectedTokenCount: entries.reduce((sum, e) => sum + e.protectedSegments.length, 0),
      entriesWithSpeaker: 0,
      entriesWithListener: 0,
      entriesWithExplicitGender: 0,
      entriesWithInferredContext: entries.filter((e) => e.context?.contextText || e.context?.developerNote).length,
      conversationGroups: 0,
      warnings: missingTranslations,
      errors: 0,
    },
  }
}
