import { describe, expect, it } from 'vitest'
import { matchesSearch, parseSearchQuery } from './advancedSearch'
import { emptyProjectMetadata } from './projectMetadata'

const entry = { id: 'a', key: 'menu.open', source: 'Open menu', translation: 'افتح القائمة', context: 'UI', keyPath: ['menu'], sourcePath: ['menu'] }
describe('advanced search', () => {
  it('parses structured terms and retains text', () => { expect(parseSearchQuery('status:approved tag:ui Open')).toEqual({ text: 'Open', status: 'approved', tag: 'ui' }) })
  it('matches status, tags, validation and text', () => { const metadata = emptyProjectMetadata(); metadata.tags.push({ id: 'ui', label: 'UI' }); metadata.entryTags.a = ['ui']; expect(matchesSearch(entry, parseSearchQuery('status:approved tag:ui has:error Open'), { a: { status: 'approved' } }, metadata, new Set(['a']), new Set())).toBe(true) })
})