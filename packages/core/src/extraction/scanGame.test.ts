import { describe, expect, it } from 'vitest'
import { scanGame, type ScanFile } from './scanGame'

function makeFile(name: string, content: string): { file: ScanFile; content: string } {
  return {
    file: { name, relativePath: name, size: content.length },
    content,
  }
}

function memoryReader(files: Map<string, { content: string }>) {
  return {
    readText: async (file: ScanFile) => files.get(file.name)?.content ?? '',
    readBinary: async (file: ScanFile) => {
      const text = files.get(file.name)?.content ?? ''
      return new TextEncoder().encode(text)
    },
  }
}

describe('scanGame orchestrator', () => {
  it('detects Godot and extracts CSV + dialogue JSON', async () => {
    const fixtures = new Map<string, { content: string }>()
    const project = makeFile('project.godot', '; Godot project')
    const csv = makeFile('game.csv', 'keys,en,ar\ngreeting,Hello,مرحبا\n')
    const json = makeFile('dialogue.json', JSON.stringify([
      { speaker: 'Mira', text: 'Where have you been?', speakerGender: 'female' },
    ]))
    fixtures.set(project.file.name, { content: project.content })
    fixtures.set(csv.file.name, { content: csv.content })
    fixtures.set(json.file.name, { content: json.content })

    const result = await scanGame({
      files: [project.file, csv.file, json.file],
      reader: memoryReader(fixtures),
    })

    expect(result.detection.engine).toBe('godot')
    expect(result.entries.length).toBeGreaterThanOrEqual(2)
    expect(result.stats.entriesFound).toBe(result.entries.length)
    expect(result.entries.some((e) => e.sourceText === 'Where have you been?')).toBe(true)
  })

  it('is read-only: source content is unchanged after scan', async () => {
    const fixtures = new Map<string, { content: string }>()
    const before = makeFile('game.csv', 'keys,en\ngreeting,Hello\n')
    fixtures.set(before.file.name, { content: before.content })

    await scanGame({
      files: [before.file],
      reader: memoryReader(fixtures),
    })

    // Content is byte-identical after extraction (no write path exists).
    expect(fixtures.get('game.csv')?.content).toBe(before.content)
  })

  it('reports archives as requiring external tooling, not as translatable strings', async () => {
    const fixtures = new Map<string, { content: string }>()
    const pak = makeFile('pakchunk0.pak', 'FAKEPAKDATA')
    fixtures.set(pak.file.name, { content: pak.content })

    const result = await scanGame({
      files: [pak.file],
      reader: memoryReader(fixtures),
    })

    expect(result.entries).toHaveLength(0)
    expect(result.diagnostics.some((d) => d.kind === 'external-tool-not-found')).toBe(true)
  })

  it('supports cancellation', async () => {
    const fixtures = new Map<string, { content: string }>()
    for (let i = 0; i < 10; i += 1) {
      const f = makeFile(`dialogue_${i}.json`, JSON.stringify([{ speaker: 'A', text: `Line ${i}` }]))
      fixtures.set(f.file.name, { content: f.content })
    }
    const signal = { cancelled: true }
    const result = await scanGame({
      files: [...fixtures.keys()].map((name) => ({ name, relativePath: name, size: 0 })),
      reader: memoryReader(fixtures),
      signal,
    })
    expect(result.diagnostics.some((d) => d.kind === 'cancelled')).toBe(true)
  })
})
