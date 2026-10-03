import { describe, expect, it } from 'vitest'
import { duplicateTranslationIds, type EntryWorkflowMap } from '@localizationhub/core'
import { buildEntryCollection, entryIssues, entryStatus } from './workspace/entryCollection'

function makeEntries(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `entry-${index}`,
    key: `menu.${index}`,
    source: `Source {${index}}`,
    translation: index % 2 === 0 ? `Translation ${index}` : '',
  }))
}

const workflowEntries: EntryWorkflowMap = {
  'entry-0': { status: 'approved' },
  'entry-2': { status: 'needs-review' },
  'entry-4': { status: 'translated' },
}

describe('entry collection filtering', () => {
  const entries = makeEntries(100)

  it('derives untranslated vs translated status', () => {
    expect(entryStatus({ translation: '' }, {})).toBe('untranslated')
    expect(entryStatus({ translation: 'hello' }, {})).toBe('translated')
    expect(entryStatus({ id: 'x', translation: 'hello' }, { x: { status: 'needs-review' } })).toBe('needs-review')
  })

  it('counts statuses correctly', () => {
    const collection = buildEntryCollection({ entries, workflow: workflowEntries, filter: 'all', query: '' })
    expect(collection.counts.total).toBe(100)
    expect(collection.counts.untranslated).toBe(50)
  })
  it('keeps auxiliary filter counts honest, independently of the active search', () => {
    const collection = buildEntryCollection({ entries, workflow: workflowEntries, filter: 'tags', query: 'menu.2', taggedEntryIds: new Set(['entry-2', 'entry-4']), commentEntryIds: new Set(['entry-4']), currentUserId: 'me', assignments: { 'entry-2': 'me', 'entry-4': 'other' } })
    expect(collection.counts).toMatchObject({ tags: 2, comments: 1, 'assigned-to-me': 1 })
    expect(collection.views.map(view => view.entry.id)).toEqual(['entry-2'])
  })

  it('filters untranslated entries', () => {
    const collection = buildEntryCollection({ entries, workflow: workflowEntries, filter: 'untranslated', query: '' })
    expect(collection.views.length).toBe(50)
    expect(collection.views.every((view) => view.status === 'untranslated')).toBe(true)
  })

  it('filters by needs-review status', () => {
    const collection = buildEntryCollection({ entries, workflow: workflowEntries, filter: 'needs-review', query: '' })
    expect(collection.views.length).toBe(1)
    expect(collection.views[0].entry.id).toBe('entry-2')
  })

  it('searches source text', () => {
    const collection = buildEntryCollection({ entries, workflow: workflowEntries, filter: 'all', query: 'Source {42}' })
    expect(collection.views.length).toBe(1)
    expect(collection.views[0].entry.id).toBe('entry-42')
  })

  it('searches the stored review status rather than guessing it from translation text', () => {
    const collection = buildEntryCollection({ entries, workflow: workflowEntries, filter: 'all', query: 'status:needs-review' })
    expect(collection.views.map(view => view.entry.id)).toEqual(['entry-2'])
  })

  it('keeps unstarted entries out of the live token-error queue', () => {
    for (const translation of ['', '   ']) {
      expect(entryIssues({ source: 'Hello {0}', translation })).toEqual([])
    }
    const collection = buildEntryCollection({ entries: [{ id: 'empty', source: 'Hello {0}', translation: '' }], workflow: {}, filter: 'errors', query: '' })
    expect(collection.views).toEqual([])
    expect(collection.counts.untranslated).toBe(1)
  })

  it('detects protected token errors', () => {
    // Source has a protected token {0} but translation drops it.
    const issues = entryIssues({ source: 'Hello {0}', translation: 'Bonjour' }, 'generic')
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true)
  })

  it('detects no issues when tokens are preserved', () => {
    const issues = entryIssues({ source: 'Hello {0}', translation: 'Bonjour {0}' }, 'generic')
    expect(issues.filter((issue) => issue.severity === 'error').length).toBe(0)
  })

  it('adds the translation checks to the entry queue without duplicating token work', () => {
    const issues = entryIssues({ source: 'Save 3 slots?', translation: 'احفظ الخانات' }, 'generic')
    expect(issues.map((issue) => issue.kind)).toEqual(expect.arrayContaining(['number-dropped', 'terminal-punctuation-dropped']))
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true)
    // The concrete value travels with the issue so the UI can show it and Arabic can append it.
    expect(issues.find((issue) => issue.kind === 'number-dropped')?.detail).toBe('3')
  })

  it('reports one translation reused for another source, and counts it as a warning', () => {
    const entries = [
      { id: 'a', source: 'Start', translation: 'ابدأ' },
      { id: 'b', source: 'Begin', translation: 'ابدأ' },
      { id: 'c', source: 'Stop', translation: 'توقف' },
    ]
    const duplicates = duplicateTranslationIds(entries)
    const collection = buildEntryCollection({ entries, workflow: {}, filter: 'warnings', query: '', duplicateTranslationIds: duplicates })
    expect(collection.counts.warnings).toBe(2)
    expect(collection.views.map((view) => view.entry.id)).toEqual(['a', 'b'])
    expect(collection.views[0].issues).toContainEqual(expect.objectContaining({ kind: 'duplicate-translation', detail: 'Begin' }))
    expect(collection.views[0].hasError).toBe(false)
  })
})

describe('entry collection performance', () => {
  it('builds a filtered collection for 10,000 entries within practical bounds', () => {
    const entries = makeEntries(10_000)
    const start = performance.now()
    const collection = buildEntryCollection({ entries, workflow: {}, filter: 'untranslated', query: 'menu.99' })
    const elapsed = performance.now() - start
    expect(collection.counts.total).toBe(10_000)
    expect(collection.views.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(1500)
  })
})
