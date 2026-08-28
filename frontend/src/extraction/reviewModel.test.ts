/*
 * Pure review-model tests (no DOM). These pin the filter/count/diagnostics/
 * source-grouping behaviour that the Extraction Review UI depends on, so the
 * "buttons appear to do nothing" regression cannot return silently.
 */

import { describe, expect, it } from 'vitest'
import {
  filterEntries,
  computeFilterCounts,
  computeIncludedExcluded,
  groupSources,
  categorizeDiagnostics,
  summarizeDiagnostics,
  severityOf,
} from './reviewModel'
import type { ExtractedEntry } from '@localizationhub/core'

function entry(partial: Partial<ExtractedEntry>): ExtractedEntry {
  return {
    id: partial.id ?? 'id',
    order: 0,
    sourceText: partial.sourceText ?? '',
    classification: partial.classification ?? 'UI',
    classificationConfidence: partial.classificationConfidence ?? 'high',
    origin: { engine: 'godot', containerPath: partial.origin?.containerPath },
    protectedSegments: partial.protectedSegments ?? [],
    protectionProfile: 'godot',
    ...partial,
  }
}

const entries: ExtractedEntry[] = [
  entry({ id: 'a', sourceText: 'Hello there', classification: 'Dialogue', context: { speaker: 'Mark' }, origin: { engine: 'godot', containerPath: 'story/1.inkb' } }),
  entry({ id: 'b', sourceText: 'Goodbye now', classification: 'Dialogue', context: { speaker: 'Ryan' }, origin: { engine: 'godot', containerPath: 'story/1.inkb' } }),
  entry({ id: 'c', sourceText: 'Play', classification: 'UI', origin: { engine: 'godot', containerPath: 'ui.tscn' } }),
  entry({ id: 'd', sourceText: 'Settings', classification: 'Menu', origin: { engine: 'godot', containerPath: 'ui.tscn' } }),
  entry({ id: 'e', sourceText: 'x', classification: 'NonTranslatable', origin: { engine: 'godot', containerPath: 'misc.json' } }),
]

describe('filterEntries', () => {
  it('filters dialogue', () => {
    const result = filterEntries(entries, 'dialogue', '', new Set())
    expect(result.map((e) => e.id).sort()).toEqual(['a', 'b'])
  })

  it('filters ui (includes menu)', () => {
    const result = filterEntries(entries, 'ui', '', new Set())
    expect(result.map((e) => e.id).sort()).toEqual(['c', 'd'])
  })

  it('excludes by file', () => {
    const result = filterEntries(entries, 'dialogue', '', new Set(['story/1.inkb']))
    expect(result).toHaveLength(0)
  })

  it('searches across text and speaker', () => {
    const result = filterEntries(entries, 'all', 'Ryan', new Set())
    expect(result.map((e) => e.id)).toEqual(['b'])
  })
})

describe('computeFilterCounts', () => {
  it('counts each filter', () => {
    const counts = computeFilterCounts(entries, new Set())
    expect(counts.dialogue).toBe(2)
    expect(counts.ui).toBe(2)
    expect(counts['has-speaker']).toBe(2)
    expect(counts['has-listener']).toBe(0)
    expect(counts.all).toBe(5)
  })
})

describe('computeIncludedExcluded', () => {
  it('counts included/excluded', () => {
    expect(computeIncludedExcluded(entries, new Set(['a']), new Set())).toEqual({ included: 4, excluded: 1 })
    expect(computeIncludedExcluded(entries, new Set(), new Set(['ui.tscn']))).toEqual({ included: 3, excluded: 2 })
  })
})

describe('groupSources', () => {
  it('groups and sorts by count', () => {
    const groups = groupSources(entries, new Set())
    expect(groups[0].path).toBe('story/1.inkb')
    expect(groups[0].count).toBe(2)
    expect(groups[0].excluded).toBe(false)
    expect(groups).toHaveLength(3)
  })
})

describe('diagnostics categorization', () => {
  it('maps severity by kind', () => {
    expect(severityOf('parser-error')).toBe('error')
    expect(severityOf('low-confidence')).toBe('warning')
    expect(severityOf('binary-resource-not-converted')).toBe('unsupported')
  })

  it('summarizes groups', () => {
    const groups = categorizeDiagnostics([
      { kind: 'parser-error', message: 'boom', count: 7, path: 'a.inkb' },
      { kind: 'binary-resource-not-converted', message: 'needs conversion', count: 177 },
      { kind: 'low-confidence', message: 'low', count: 3 },
    ])
    const summary = summarizeDiagnostics(groups)
    expect(summary.groups).toBe(3)
    expect(summary.errors).toBe(7)
    expect(summary.unsupported).toBe(177)
    expect(summary.warnings).toBe(3)
  })
})
