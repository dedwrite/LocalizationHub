import { describe, expect, it } from 'vitest'
import { advanceKonamiProgress, GAME_MEME_KEYS, KONAMI_SEQUENCE } from './gameSecrets'

describe('game culture secrets', () => {
  it('unlocks only after the complete classic sequence', () => {
    let progress = 0
    for (const key of KONAMI_SEQUENCE) progress = advanceKonamiProgress(progress, key)
    expect(progress).toBe(KONAMI_SEQUENCE.length)
  })

  it('recovers cleanly after a wrong key and keeps several distinct references', () => {
    expect(advanceKonamiProgress(4, 'x')).toBe(0)
    expect(advanceKonamiProgress(5, 'ArrowUp')).toBe(1)
    expect(new Set(GAME_MEME_KEYS).size).toBe(12)
  })
})
