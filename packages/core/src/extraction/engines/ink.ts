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
  return extractInkJson(input.fileName, input.text)
}
