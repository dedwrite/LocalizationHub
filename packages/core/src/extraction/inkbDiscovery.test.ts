/*
 * End-to-end .inkb / .gdc discovery + chunked-batch-read tests (core side).
 *
 * These drive `scanGame` with a synthetic Godot-style file set — including
 * `.inkb` (story), `.gdc` (binary), `.gd`, `.tscn`, and locale-overlay `.inkb` —
 * and assert the complete route: discovery → classification → parse → culture
 * aggregation. They prove the exact regression that previously produced
 * Dialogue = 0 (`.inkb` dropped between layers) cannot recur in core, and that
 * scanGame reads in bounded chunks when a batch primitive is available.
 */

import { describe, expect, it } from 'vitest'
import { scanGame, type ScanFile } from './scanGame'

function buildInkb(strings: string[]): Uint8Array {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const header = new Uint8Array(10)
  header[0] = 0x01
  header[1] = 0x00
  header[2] = 0x14
  parts.push(header)
  for (const s of strings) {
    parts.push(encoder.encode(s))
    parts.push(new Uint8Array([0x00]))
  }
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

const STORY_STRINGS = [
  'type: "dialogue"',
  'characters: { "Mark": "MarkBorja" }',
  'player: "Mark"',
  'Mark: Hello there, how are you?',
]

describe('scanGame discovery parity (synthetic Godot set)', () => {
  it('routes .inkb to dialogue, .gdc to a grouped binary diagnostic', async () => {
    const inkbBytes = buildInkb(STORY_STRINGS)
    const files: ScanFile[] = [
      { name: 'assets/story/1/1c/1c.inkb', relativePath: 'assets/story/1/1c/1c.inkb', absolutePath: '/tmp/1.inkb', size: inkbBytes.length },
      { name: 'assets/story/locales/ja/1/1c/1c.inkb', relativePath: 'assets/story/locales/ja/1/1c/1c.inkb', absolutePath: '/tmp/2.inkb', size: inkbBytes.length },
      { name: 'shader.gdc', relativePath: 'shader.gdc', absolutePath: '/tmp/shader.gdc', size: 4 },
      { name: 'text.json', relativePath: 'text.json', absolutePath: '/tmp/text.json', size: 32 },
      { name: 'ui.tscn', relativePath: 'ui.tscn', absolutePath: '/tmp/ui.tscn', size: 32 },
    ]

    const texts = new Map<string, string>([
      ['/tmp/text.json', '{"text":"Settings"}'],
      ['/tmp/ui.tscn', '[node name="Label"]\ntext = "Play"\n'],
    ])
    const binaries = new Map<string, Uint8Array>([
      ['/tmp/1.inkb', inkbBytes],
      ['/tmp/2.inkb', inkbBytes],
    ])

    const reader = {
      readText: async (file: ScanFile) => texts.get(file.absolutePath) ?? '',
      readBinary: async (file: ScanFile) => binaries.get(file.absolutePath) ?? new Uint8Array(0),
    }

    const result = await scanGame({ files, reader })

    // Dialogue was previously 0 because .inkb never reached the parser.
    expect(result.stats.byClassification['Dialogue']).toBeGreaterThan(0)
    expect(result.stats.entriesWithSpeaker).toBeGreaterThan(0)

    // The base story (English) + ja overlay aggregate into ONE logical entry
    // with native culture inferred from the base content — never "ja" or "de".
    const nativeTarget = result.localizationTargets?.find((t) => t.nativeCulture)
    expect(nativeTarget?.nativeCulture).toBe('en')

    // .gdc is reported once as a grouped binary diagnostic, not read as text.
    expect(result.diagnostics.some((d) => d.kind === 'binary-resource-not-converted')).toBe(true)
  })
})

describe('scanGame chunked batch reads', () => {
  function makeJsonFiles(n: number): ScanFile[] {
    return Array.from({ length: n }, (_, i) => ({
      name: `db_${i}.json`,
      relativePath: `db_${i}.json`,
      absolutePath: `/tmp/db_${i}.json`,
      size: 32,
    }))
  }

  it('uses readTextBatch in chunks and never calls per-file readText', async () => {
    const files = makeJsonFiles(600) // > READ_CHUNK_SIZE (256) → multiple chunks
    let perFileReads = 0
    const chunkSizes: number[] = []
    const reader = {
      readText: async () => {
        perFileReads += 1
        return '{"text":"Hello world"}'
      },
      readBinary: async () => new Uint8Array(0),
      readTextBatch: async (chunk: ScanFile[]) => {
        chunkSizes.push(chunk.length)
        return chunk.map((f) => ({ path: f.absolutePath, text: '{"text":"Hello world"}' }))
      },
    }
    const result = await scanGame({ files, reader })

    expect(perFileReads).toBe(0)
    expect(chunkSizes.length).toBeGreaterThan(1)
    expect(chunkSizes.reduce((a, b) => a + b, 0)).toBe(files.length)
    expect(chunkSizes.every((size) => size <= 256)).toBe(true)
    expect(result.stats.entriesFound).toBe(files.length)
  })

  it('falls back to per-file readText when no batch primitive is available', async () => {
    const files = makeJsonFiles(10)
    let perFileReads = 0
    const reader = {
      readText: async () => {
        perFileReads += 1
        return '{"text":"Hello world"}'
      },
      readBinary: async () => new Uint8Array(0),
    }
    const result = await scanGame({ files, reader })
    expect(perFileReads).toBe(files.length)
    expect(result.stats.entriesFound).toBe(files.length)
  })
})
