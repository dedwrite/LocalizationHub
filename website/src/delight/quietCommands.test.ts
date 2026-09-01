import { describe, expect, it } from 'vitest'
import {
  listDynamicQuietCommands,
  listQuietCommands,
  matchQuietCommands,
  registerQuietCommands,
  registerQuietDynamicProvider,
} from './quietCommands'

describe('quietCommands', () => {
  it('registers, matches and unregisters commands', () => {
    const run = () => undefined
    const dispose = registerQuietCommands([
      { id: 'test.export', label: 'Export localization file', keywords: 'download', run },
      { id: 'test.home', label: 'Open Cloud Projects', keywords: 'projects', run },
    ])
    expect(listQuietCommands().map((item) => item.id).sort()).toEqual(['test.export', 'test.home'])
    expect(matchQuietCommands('export').map((item) => item.id)).toEqual(['test.export'])
    dispose()
    expect(listQuietCommands().some((item) => item.id.startsWith('test.'))).toBe(false)
  })

  it('keeps dynamic providers search-gated', () => {
    const dispose = registerQuietDynamicProvider((query) => [{
      id: 'entry.jump.demo',
      label: `Go to ${query}`,
      run: () => undefined,
    }])
    expect(listDynamicQuietCommands('a')).toEqual([])
    expect(listDynamicQuietCommands('settings').map((item) => item.id)).toEqual(['entry.jump.demo'])
    dispose()
    expect(listDynamicQuietCommands('settings')).toEqual([])
  })
})
