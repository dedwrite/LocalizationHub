/*
 * Yarn Spinner narrative adapter (extraction only).
 *
 * Yarn Spinner is a narrative language commonly embedded in Unity games. Its
 * source uses `<<command>>` directives, `-> jump`, `title: line`, `Speaker:
 * line`, `*`/`-` options, and `#` tags. This adapter extracts only
 * structurally-proven narrative surfaces — never arbitrary directives or
 * variable assignments.
 */

import { detectEngine } from '../engineDetection'
import type { ExtractedEntry, ExtractionResult } from '../types'
import { buildEntry } from './shared'

type YarnInput = {
  fileName: string
  text: string
}

export function extractYarn(input: YarnInput): ExtractionResult {
  const entries: ExtractedEntry[] = []
  let order = 0
  const conversationId = `yarn:${input.fileName}`
  let currentTitle: string | undefined

  const lines = input.text.replace(/\r\n/g, '\n').split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Node header: title: MyNode
    const titleMatch = line.match(/^title:\s*(.+)$/iu)
    if (titleMatch) {
      currentTitle = titleMatch[1].trim()
      continue
    }

    // Tags.
    if (/^#\s/u.test(line)) continue
    // Directives / commands / jumps / declarations.
    if (/^<<[^>]*>>$/u.test(line)) continue
    if (/^->\s*$/u.test(line) || /^->\s*\w/u.test(line)) continue
    if (/^(<<(declare|set|if|elseif|else|endif|jump|call)\b)/iu.test(line)) continue
    if (/^[/][/]/u.test(line)) continue

    // Choice option.
    const choiceMatch = line.match(/^(?:->\s*)?[*>-]\s*(.+)$/u)
    if (choiceMatch && /^[*>-]/u.test(line)) {
      const choice = choiceMatch[1].replace(/\[\[.*?\]\]/gu, '').trim()
      if (!choice) continue
      entries.push(buildEntry({
        id: `yarn:${input.fileName}:${order}`,
        order: order++,
        sourceText: choice,
        classification: 'Choice',
        classificationConfidence: 'high',
        context: { conversationId, scene: currentTitle, choiceGroup: currentTitle },
        origin: { engine: 'unity', containerPath: input.fileName, objectType: 'yarn-choice', row: String(order) },
        protectedSegments: [],
        protectionProfile: 'generic',
      }))
      continue
    }

    // Speaker: line
    const speakerMatch = line.match(/^([A-Za-z][A-Za-z0-9 ._-]*):\s*(.+)$/u)
    if (speakerMatch) {
      const speaker = speakerMatch[1].trim()
      const spoken = speakerMatch[2].trim()
      if (!spoken || spoken.startsWith('<<')) continue
      entries.push(buildEntry({
        id: `yarn:${input.fileName}:${order}`,
        order: order++,
        sourceText: spoken,
        classification: 'Dialogue',
        classificationConfidence: 'high',
        context: { speaker, conversationId, scene: currentTitle },
        origin: { engine: 'unity', containerPath: input.fileName, objectType: 'yarn-line', row: String(order) },
        protectedSegments: [],
        protectionProfile: 'generic',
      }))
      continue
    }

    // Bare narration line (prose with at least 2 letters).
    if (/<<|>>|->|^\w+\s*[=:]/u.test(line)) continue
    if (!/[A-Za-z\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF]{2,}/u.test(line)) continue
    entries.push(buildEntry({
      id: `yarn:${input.fileName}:${order}`,
      order: order++,
      sourceText: line,
      classification: 'Dialogue',
      classificationConfidence: 'medium',
      context: { conversationId, scene: currentTitle },
      origin: { engine: 'unity', containerPath: input.fileName, objectType: 'yarn-narration', row: String(order) },
      protectedSegments: [],
      protectionProfile: 'generic',
    }))
  }

  return {
    engine: 'unity',
    detection: detectEngine({ files: [{ name: input.fileName, lower: input.fileName.toLowerCase() }], directories: [] }),
    entries,
    diagnostics: [],
    stats: { filesScanned: 1, candidateFiles: 1, entriesFound: entries.length, byClassification: entries.reduce<Record<string, number>>((acc, e) => { acc[e.classification] = (acc[e.classification] ?? 0) + 1; return acc }, {}), protectedTokenCount: 0, entriesWithSpeaker: entries.filter((e) => e.context?.speaker).length, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: entries.filter((e) => e.context?.conversationId || e.context?.scene).length, conversationGroups: entries.length > 0 ? 1 : 0, warnings: 0, errors: 0 },
  }
}
