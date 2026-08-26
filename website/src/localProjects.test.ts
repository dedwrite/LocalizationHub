import { describe, expect, it } from 'vitest'
import { exportLocalFile, importLocalFile } from './localProjects'

describe('browser-local localization files', () => {
  it('round-trips JSON through the core parser and exporter', () => {
    const parsed = importLocalFile('{"menu.start":"Start"}', 'strings.json')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    parsed.document.entries[0].translation = 'Commencer'
    const exported = exportLocalFile(parsed.document)
    expect(exported).toContain('Commencer')
    expect(exported).toContain('menu.start')
  })

  it('rejects unsupported browser-local extensions', () => {
    const parsed = importLocalFile('hello', 'strings.txt')
    expect(parsed.ok).toBe(false)
  })
})
