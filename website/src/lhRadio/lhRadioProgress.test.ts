import { describe, expect, it } from 'vitest'
import { playbackProgressPercent } from './lhRadioProgress'

describe('collapsed Radio playback progress', () => {
  it('uses an inactive ring when duration is unavailable', () => {
    expect(playbackProgressPercent(12, 0)).toBe(0)
    expect(playbackProgressPercent(12, Number.NaN)).toBe(0)
    expect(playbackProgressPercent(Number.NaN, 120)).toBe(0)
  })

  it('maps playback to the full 0–100 range', () => {
    expect(playbackProgressPercent(0, 120)).toBe(0)
    expect(playbackProgressPercent(30, 120)).toBe(25)
    expect(playbackProgressPercent(60, 120)).toBe(50)
    expect(playbackProgressPercent(90, 120)).toBe(75)
    expect(playbackProgressPercent(119.9, 120)).toBeCloseTo(99.9167, 3)
    expect(playbackProgressPercent(160, 120)).toBe(100)
    expect(playbackProgressPercent(-1, 120)).toBe(0)
  })
})
