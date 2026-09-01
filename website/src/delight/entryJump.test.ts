import { describe, expect, it, vi } from 'vitest'
import { entryJumpCommands } from './entryJump'

describe('entryJumpCommands', () => {
  it('returns capped search-driven jump commands', () => {
    const jump = vi.fn()
    const commands = entryJumpCommands([
      { id: 'a', key: 'menu.settings', source: 'Open settings' },
      { id: 'b', key: 'menu.save', source: 'Save game' },
      { id: 'c', key: 'quest.accept', source: 'Accept the quest' },
    ], 'settings', jump)
    expect(commands).toHaveLength(1)
    expect(commands[0].label).toContain('menu.settings')
    commands[0].run()
    expect(jump).toHaveBeenCalledWith(0)
  })

  it('ignores short queries through the provider gate separately', () => {
    expect(entryJumpCommands([{ id: 'a', source: 'Hello' }], 'h', () => undefined)).toHaveLength(1)
  })
})
