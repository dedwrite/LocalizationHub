import { afterEach, describe, expect, it, vi } from 'vitest'
import { messages } from '@localizationhub/i18n'
import { chooseTip, setTipsHidden, shuffledTips, tipDecks, tipsHidden } from './tips'

afterEach(() => vi.unstubAllGlobals())
describe('contextual tip decks', () => {
  it('has complete, unique bilingual tips in every deck', () => {
    expect(new Set(Object.values(tipDecks).flat()).size).toBe(64)
    for (const deck of Object.values(tipDecks)) {
      expect(new Set(deck).size).toBe(deck.length)
      expect(deck.length).toBe(14)
      for (const key of deck) { expect(messages[key].en).toBeTruthy(); expect(messages[key].ar).toBeTruthy() }
    }
  })
  it('exhausts every tip once before repetition and avoids a boundary repeat', () => {
    for (const sample of [0, .3, .8, 1]) {
      const order = shuffledTips(14, -1, () => sample)
      expect(new Set(order).size).toBe(14)
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 14 }, (_, index) => index))
      expect(shuffledTips(14, order[13], () => sample)[0]).not.toBe(order[13])
    }
  })
  it('never repeats the current tip on explicit next, including end samples', () => {
    for (const previous of [0, 1, 2, 3]) for (const sample of [0, .2, .4, .7, .999, 1]) {
      const next = chooseTip(4, previous, () => sample)
      expect(next).not.toBe(previous); expect(next).toBeGreaterThanOrEqual(0); expect(next).toBeLessThan(4)
    }
    expect(chooseTip(1, 0)).toBe(0)
  })
  it('can select every initial tip', () => {
    expect([0, .25, .5, .75].map(sample => chooseTip(4, -1, () => sample))).toEqual([0, 1, 2, 3])
  })
  it('keeps hide preferences scoped and supports restoring them', () => {
    const values = new Map()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) })
    setTipsHidden('editor', true)
    expect(tipsHidden('editor')).toBe(true); expect(tipsHidden('landing')).toBe(false)
    setTipsHidden('editor', false); expect(tipsHidden('editor')).toBe(false)
  })
  it('remains usable when browser storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('full') } })
    expect(tipsHidden('local')).toBe(false)
    expect(() => setTipsHidden('local', true)).not.toThrow()
  })
})
