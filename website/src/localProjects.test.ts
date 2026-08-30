import { describe, expect, it } from 'vitest'
import { exportLocalFile, importLocalFile, normalizeLocalProject, projectFromLocalDocument, exportLocalProject } from './localProjects'
import { createTokenProfileConfig } from '@localizationhub/core'

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

  it('migrates the legacy document in memory without losing IDs, translations, context or source/export structure', () => {
    const source = JSON.stringify([{ entry_id: '23', speaker: 'Caloy', speaker_gender: 'male', receiver: 'Mark', receiver_gender: 'male', text_en: 'Hello {name}', text_ar: '' }])
    const parsed = importLocalFile(source, 'legacy.json')
    if (!parsed.ok) throw new Error(parsed.reason)
    parsed.document.entries[0].translation = 'مرحباً {name}'
    const original = JSON.stringify(parsed.document)
    const project = normalizeLocalProject(parsed.document, 'legacy.json')
    expect(project.version).toBe(3)
    expect(project.entries).toEqual(parsed.document.entries)
    expect(project.entries[0].dialogueContext).toMatchObject({ speaker: 'Caloy', listener: 'Mark', listenerGender: 'male' })
    expect(project.document.sourceText).toBe(source)
    expect(JSON.stringify(parsed.document)).toBe(original)
    expect(JSON.parse(exportLocalProject(project))[0]).toMatchObject({ receiver: 'Mark', text_ar: 'مرحباً {name}' })
  })

  it('retains complete V3 workflow, selected entry, context and manual profile across serialization', () => {
    const parsed = importLocalFile('{"one":"One","two":"Two"}', 'current.json')
    if (!parsed.ok) throw new Error(parsed.reason)
    const project = projectFromLocalDocument(parsed.document, 'current.json')
    project.entries[0].translation = 'واحد'
    project.workflow.entries[project.entries[0].id] = { status: 'approved' }
    project.tokenProfile = 'unity'; project.tokenProfileConfig = createTokenProfileConfig('unity')
    project.selectedEntryId = project.entries[1].id
    const restored = normalizeLocalProject(JSON.parse(JSON.stringify(project)), 'ignored.json')
    expect(restored).toEqual(project)
    expect(exportLocalProject(restored)).not.toContain('LocalizationHubProject')
  })

  it.each([null, {}, { parser: 'json', entries: [], sourceText: '{}' }, { format: 'LocalizationHubProject', version: 99 }])('rejects corrupt/unsupported local records safely: %j', (value) => {
    expect(() => normalizeLocalProject(value, 'bad.json')).toThrow()
  })

  it.each([['sample.csv', 'key,en,ar\nhello,Hello,'], ['sample.po', 'msgid "Hello"\nmsgstr ""\n'], ['sample.pot', 'msgid "Hello"\nmsgstr ""\n']])('retains original source format on export: %s', (name, text) => {
    const parsed = importLocalFile(text, name)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const project = projectFromLocalDocument(parsed.document, name)
    project.entries[0].translation = 'مرحبا'
    const exported = exportLocalProject(project)
    expect(exported).toContain('مرحبا')
    expect(exported).not.toContain('LocalizationHubProject')
  })
})
