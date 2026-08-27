import { describe, expect, it } from 'vitest'
import { buildProjectFromExtraction } from './projectFromExtraction'
import { extractGodot } from './engines/godot'
import { decodeLocalizationProject } from '../projectModel'
import { classifyString } from './classification'
import { computeExtractionStats } from './extractionReview'
import { detectEngine } from './engineDetection'
import type { ExtractionResult } from './types'

function buildLargeResult(count: number): ExtractionResult {
  const entries = Array.from({ length: count }, (_, i) => ({
    id: `entry-${i}`,
    key: `key_${i}`,
    order: i,
    sourceText: i % 3 === 0 ? `Dialogue line number ${i} with some natural language words.` : `UI label ${i}`,
    classification: (i % 3 === 0 ? 'Dialogue' : 'UI') as 'Dialogue' | 'UI',
    classificationConfidence: 'high' as const,
    context: i % 5 === 0 ? { speaker: 'Mira', listener: 'Player', scene: 'chapter3', conversationId: `conv-${i % 10}` } : undefined,
    origin: { engine: 'godot' as const, containerPath: `dialogue_${i % 20}.json`, key: `key_${i}` },
    protectedSegments: i % 4 === 0 ? [{ raw: '{0}', kind: 'format', start: 0, end: 3, ruleId: 'brace' }] : [],
    protectionProfile: 'godot',
  }))

  return {
    engine: 'godot',
    detection: detectEngine({ files: [{ name: 'project.godot', lower: 'project.godot' }], directories: [] }),
    entries,
    diagnostics: [],
    stats: computeExtractionStats({ engine: 'godot', detection: { engine: 'godot', familyLabel: 'Godot', confidence: 'high', evidence: [] }, entries, diagnostics: [], stats: { filesScanned: 1, candidateFiles: 1, entriesFound: count, byClassification: {}, protectedTokenCount: 0, entriesWithSpeaker: 0, entriesWithListener: 0, entriesWithExplicitGender: 0, entriesWithInferredContext: 0, conversationGroups: 0, warnings: 0, errors: 0 } }),
  }
}

describe('project round-trip', () => {
  it('preserves extraction metadata (speaker/listener/gender/classification/origin) through a V3 serialize/parse round-trip', () => {
    const result = extractGodot({
      fileName: 'dialogue.json',
      text: JSON.stringify([
        { speaker: 'Mira', listener: 'Player', speakerGender: 'female', text: 'Where have you been?', scene: 'chapter3', conversationId: 'c1' },
      ]),
    })
    const project = buildProjectFromExtraction(result, 'game.extracted')

    // Serialize to JSON and decode back (as the desktop .lhproj and Cloud do).
    const json = JSON.stringify(project)
    const decoded = decodeLocalizationProject(json)

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    const roundTripped = decoded.project
    expect(roundTripped.metadata?.extraction).toBeDefined()
    const extraction = roundTripped.metadata?.extraction
    const entryId = roundTripped.entries[0].id

    expect(extraction?.engine).toBe('godot')
    expect(extraction?.entries[entryId]?.context?.speaker).toBe('Mira')
    expect(extraction?.entries[entryId]?.context?.listener).toBe('Player')
    expect(extraction?.entries[entryId]?.context?.speakerGender).toBe('female')
    expect(extraction?.entries[entryId]?.context?.scene).toBe('chapter3')
    expect(extraction?.entries[entryId]?.context?.conversationId).toBe('c1')
    expect(extraction?.entries[entryId]?.origin?.engine).toBe('godot')
    expect(extraction?.entries[entryId]?.origin?.fieldPath).toBeDefined()
    expect(extraction?.entries[entryId]?.classification).toBe('Dialogue')
  })
})

describe('performance benchmarks (correctness assertions)', () => {
  for (const count of [10_000, 50_000, 100_000]) {
    it(`filters, classifies, and converts ${count} entries within a bounded time`, () => {
      const result = buildLargeResult(count)
      const started = Date.now()

      // Classification over all entries.
      let translatable = 0
      for (const entry of result.entries) {
        const decision = classifyString(entry.sourceText, { knownLocalizedField: true })
        if (decision.translatable) translatable += 1
      }

      // Review aggregation.
      const stats = computeExtractionStats(result)

      // Project conversion with a subset filter (exclude every 4th entry).
      const included = new Set(result.entries.filter((_, i) => i % 4 !== 0).map((e) => e.id))
      const project = buildProjectFromExtraction(result, 'bench.json', included)

      const elapsed = Date.now() - started

      expect(translatable).toBe(count)
      expect(stats.entriesFound).toBe(count)
      expect(project.entries.length).toBe(Math.floor(count * 0.75))
      // Generous upper bound: these operations are O(n) and must complete well
      // under 30s even at 100k entries (they complete in well under 1s).
      expect(elapsed).toBeLessThan(30_000)
    })
  }
})
