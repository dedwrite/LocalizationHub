/*
 * Unity TextAsset routing acceptance test.
 *
 * Proves the end-to-end path required by the gap-closing pass:
 *   UnityPy helper output (textassets/*.ink / .yarn / .xml / .yaml / .json)
 *   → native-style candidate discovery (classifyFileKind)
 *   → correct adapter
 *   → entries.
 *
 * `.ink`/`.yarn` route to the narrative adapters (speaker/choice preservation);
 * `.xml`/`.yaml` route to the cautious structured adapters (only schema-evidenced
 * localizable fields, never arbitrary text nodes/values).
 */

import { describe, expect, it } from 'vitest'
import { scanGame, classifyFileKind, type ScanFile } from './scanGame'

function file(name: string, text: string): ScanFile {
  return { name, relativePath: name, absolutePath: `/tmp/${name}`, size: text.length }
}

async function scanOne(name: string, text: string) {
  const files = [file(name, text)]
  const reader = {
    readText: async (f: ScanFile) => (f.absolutePath === `/tmp/${name}` ? text : ''),
    readBinary: async () => new Uint8Array(0),
  }
  return scanGame({ files, reader, engineHint: 'unity' })
}

describe('Unity TextAsset routing', () => {
  it('discovers .ink/.yarn/.xml/.yaml as text resources (not unknown)', () => {
    for (const ext of ['.ink', '.yarn', '.xml', '.yaml']) {
      expect(classifyFileKind(file(`x${ext}`, 'x'))).toBe('text-resource')
    }
  })

  it('routes .ink source to the narrative adapter (speaker + choice)', async () => {
    const ink = '=== start\nMark: Hello there\n* Greet back\n-> next\n'
    const result = await scanOne('story.ink', ink)
    const dialogue = result.entries.filter((e) => e.classification === 'Dialogue')
    const choices = result.entries.filter((e) => e.classification === 'Choice')
    expect(dialogue.some((e) => e.sourceText === 'Hello there' && e.context?.speaker === 'Mark')).toBe(true)
    expect(choices.some((e) => e.sourceText === 'Greet back')).toBe(true)
  })

  it('routes .yarn to the Yarn adapter (speaker + title)', async () => {
    const yarn = 'title: Start\nMark: Welcome\n-> End\n'
    const result = await scanOne('dialogue.yarn', yarn)
    const dialogue = result.entries.filter((e) => e.classification === 'Dialogue')
    expect(dialogue.some((e) => e.sourceText === 'Welcome' && e.context?.speaker === 'Mark')).toBe(true)
    expect(dialogue.some((e) => e.context?.scene === 'Start')).toBe(true)
  })

  it('routes .xml to the cautious structured adapter (only localizable elements)', async () => {
    const xml = '<root><string name="play">Play</string><config>internal</config><text>Continue</text></root>'
    const result = await scanOne('strings.xml', xml)
    const texts = result.entries.map((e) => e.sourceText)
    expect(texts).toContain('Play')
    expect(texts).toContain('Continue')
    // <config> is NOT a localizable element → not extracted.
    expect(texts).not.toContain('internal')
  })

  it('routes .yaml to the cautious flat-subset adapter', async () => {
    const yaml = 'title: "Chapter One"\nsubtitle: "Prologue"\nversion: 1.0\n'
    const result = await scanOne('data.yaml', yaml)
    const texts = result.entries.map((e) => e.sourceText)
    expect(texts).toContain('Chapter One')
    expect(texts).toContain('Prologue')
    // version is not a localizable key → not extracted.
    expect(texts).not.toContain('1.0')
  })
})
