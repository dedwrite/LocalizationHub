import { describe, expect, it } from 'vitest'
import type { EntryWorkflowMap } from '@localizationhub/core'
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

  it('detects protected token errors', () => {
    // Source has a protected token {0} but translation drops it.
    const issues = entryIssues({ source: 'Hello {0}', translation: 'Bonjour' }, 'generic')
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true)
  })

  it('detects no issues when tokens are preserved', () => {
    const issues = entryIssues({ source: 'Hello {0}', translation: 'Bonjour {0}' }, 'generic')
    expect(issues.filter((issue) => issue.severity === 'error').length).toBe(0)
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
