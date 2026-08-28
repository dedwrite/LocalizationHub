/*
 * Ink narrative JSON adapter (extraction only).
 *
 * Ink is a narrative scripting language commonly embedded in Unity games. Its
 * compiled JSON contains a `storyContent` array of tokens; dialogue lines begin
 * with `^` and choices with `*`. This adapter extracts those as dialogue /
 * choice entries with conversation ordering preserved.
 */

import { detectEngine } from '../engineDetection'
import type { ExtractedEntry, ExtractionResult } from '../types'
import { buildEntry } from './shared'

type InkInput = {
  fileName: string
  text: string
}

function extractInkJson(fileName: string, text: string): ExtractionResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      engine: 'ink',
      detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
      entries: [],
      diagnostics: [{ kind: 'corrupt-resource', message: 'Ink JSON is not valid JSON.', path: fileName }],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
    }
  }

  const entries: ExtractedEntry[] = []
  let order = 0
  let conversationId: string | undefined

  const storyContent = (parsed as Record<string, unknown>)['storyContent'] as unknown[] | undefined
  if (!Array.isArray(storyContent)) {
    return {
      engine: 'ink',
      detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
      entries: [],
      diagnostics: [{ kind: 'unsupported-format', message: 'Ink JSON is missing storyContent.', path: fileName }],
      stats: { filesScanned: 1, candidateFiles: 1, entriesFound: 0, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 1 },
    }
  }

  for (const token of storyContent) {
    if (typeof token !== 'string') continue
    const trimmed = token.trim()

    // Dialogue line: ^line text (optionally ^speaker: line)
    if (trimmed.startsWith('^')) {
      const raw = trimmed.slice(1)
      // Skip empty / pure-command lines.
      if (!raw.trim()) continue
      if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(.*\)$/u.test(raw)) continue

      const speakerMatch = raw.match(/^([A-Za-z][A-Za-z0-9 ._-]*):\s*(.+)$/u)
      const speaker = speakerMatch?.[1]
      const line = speakerMatch?.[2] ?? raw

      if (!line.trim()) continue
      conversationId = conversationId ?? `ink-${fileName}`
      entries.push(buildEntry({
        id: `ink:${fileName}:${order}`,
        order: order++,
        sourceText: line,
        classification: 'Dialogue',
        classificationConfidence: 'high',
        context: speaker ? { speaker, conversationId, conversationProvenance: { source: 'structural-inference', confidence: 'medium' } } : { conversationId, conversationProvenance: { source: 'structural-inference', confidence: 'medium' } },
        origin: { engine: 'ink', containerPath: fileName, objectType: 'ink-line', row: String(order) },
        protectedSegments: [],
        protectionProfile: 'generic',
      }))
      continue
    }

    // Choice: *choice text (may carry conditions in [ ])
    if (trimmed.startsWith('*')) {
      const raw = trimmed.slice(1)
      const choice = raw.replace(/\[[^\]]*\]/gu, '').trim()
      if (!choice) continue
      entries.push(buildEntry({
        id: `ink:${fileName}:${order}`,
        order: order++,
        sourceText: choice,
        classification: 'Choice',
        classificationConfidence: 'high',
        context: conversationId ? { conversationId } : undefined,
        origin: { engine: 'ink', containerPath: fileName, objectType: 'ink-choice', row: String(order) },
        protectedSegments: [],
        protectionProfile: 'generic',
      }))
    }
  }

  return {
    engine: 'ink',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics: [],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: entries.length, byClassification: entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}), protectedTokenCount: 0, entriesWithSpeaker: entries.filter((e) => e.context?.speaker).length, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: entries.filter((e) => e.context?.conversationId).length, conversationGroups: 1, warnings: 0, errors: 0 },
  }
}

export function extractInk(input: InkInput): ExtractionResult {
  // Ink source files are plain text (starts with knots/stitches, `->` diverts,
  // `*` choices, `Speaker: line`); compiled Ink is JSON with `storyContent`.
  const trimmed = input.text.trimStart()
  if (trimmed.startsWith('{')) return extractInkJson(input.fileName, input.text)
  return extractInkSource(input.fileName, input.text)
}

/*
 * Ink SOURCE adapter (`.ink` text, not compiled JSON).
 *
 * Extracts only structurally-proven narrative surfaces:
 *   - `Speaker: text`  → Dialogue (with speaker)
 *   - `* text` / `+ text` → Choice
 *   - bare prose lines → Dialogue (narration), skipping knots/stitches/diverts/
 *     tags/variables/logic/comments.
 */
function extractInkSource(fileName: string, text: string): ExtractionResult {
  const entries: ExtractedEntry[] = []
  let order = 0
  const conversationId = `ink:${fileName}`

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Structural / non-text lines.
    if (/^(===|\s*=)\s*/u.test(line)) continue          // knot / stitch
    if (/^->/u.test(line)) continue                      // divert
    if (/^#\s/u.test(line)) continue                     // tag
    if (/^(VAR|LIST|CONST)\s/u.test(line)) continue      // variable decl
    if (/^~[A-Za-z_]/u.test(line)) continue              // temp/logic
    if (/^\/\//u.test(line)) continue                    // comment
    if (/^::/u.test(line)) continue                      // author comment
    if (/^\{\{/u.test(line) || /^\}/u.test(line)) continue // multiline logic
    if (/^\{\s*[A-Za-z_]/.test(line) && !/\}\s*$/.test(line)) continue

    // Choice.
    const choiceMatch = line.match(/^[*+]\s*(.+)$/u)
    if (choiceMatch) {
      const choice = choiceMatch[1].replace(/\[[^\]]*\]/gu, '').trim()
      if (!choice) continue
      entries.push(buildEntry({
        id: `ink:${fileName}:${order}`,
        order: order++,
        sourceText: choice,
        classification: 'Choice',
        classificationConfidence: 'high',
        context: { conversationId },
        origin: { engine: 'ink', containerPath: fileName, objectType: 'ink-choice', row: String(order) },
        protectedSegments: [],
        protectionProfile: 'generic',
      }))
      continue
    }

    // Dialogue with speaker.
    const speakerMatch = line.match(/^([A-Za-z][A-Za-z0-9 ._-]*):\s*(.+)$/u)
    if (speakerMatch) {
      const speaker = speakerMatch[1].trim()
      const spoken = speakerMatch[2].trim()
      if (!spoken) continue
      entries.push(buildEntry({
        id: `ink:${fileName}:${order}`,
        order: order++,
        sourceText: spoken,
        classification: 'Dialogue',
        classificationConfidence: 'high',
        context: { speaker, conversationId },
        origin: { engine: 'ink', containerPath: fileName, objectType: 'ink-line', row: String(order) },
        protectedSegments: [],
        protectionProfile: 'generic',
      }))
      continue
    }

    // Bare prose line (narration). Skip obvious code/logic fragments.
    if (/[{}()=<>]|->/u.test(line) && !/[\p{L}\s]{3,}/u.test(line)) continue
    if (!/[A-Za-z\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF]{2,}/u.test(line)) continue

    entries.push(buildEntry({
      id: `ink:${fileName}:${order}`,
      order: order++,
      sourceText: line,
      classification: 'Dialogue',
      classificationConfidence: 'medium',
      context: { conversationId },
      origin: { engine: 'ink', containerPath: fileName, objectType: 'ink-narration', row: String(order) },
      protectedSegments: [],
      protectionProfile: 'generic',
    }))
  }

  return {
    engine: 'ink',
    detection: detectEngine({ files: [{ name: fileName, lower: fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics: [],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: entries.length, byClassification: entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}), protectedTokenCount: 0, entriesWithSpeaker: entries.filter((e) => e.context?.speaker).length, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: entries.filter((e) => e.context?.conversationId).length, conversationGroups: entries.length > 0 ? 1 : 0, warnings: 0, errors: 0 },
  }
}
