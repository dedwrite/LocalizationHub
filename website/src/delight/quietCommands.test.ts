import { describe, expect, it } from 'vitest'
import { listQuietCommands, matchQuietCommands, registerQuietCommands } from './quietCommands'

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
})
