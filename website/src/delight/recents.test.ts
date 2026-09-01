import { afterEach, describe, expect, it, vi } from 'vitest'
import { coverage, lastCloudProject, latestDated, localCoverage, rememberCloudProject } from './recents'

afterEach(() => vi.unstubAllGlobals())
describe('resume project presentation', () => {
  it('selects the latest real timestamp without mutating source order', () => {
    const rows = [{ date: '2026-08-01', id: 'old' }, { date: 'invalid', id: 'bad' }, { date: '2026-08-31', id: 'new' }]
    expect(latestDated(rows, row => row.date)?.id).toBe('new')
    expect(rows[0].id).toBe('old')
    expect(latestDated([], () => '')).toBeUndefined()
    expect(latestDated([{ date: 'invalid' }], row => row.date)).toBeUndefined()
  })
  it('derives coverage and saved entry from existing local data without changing it', () => {
    const value = { entries: [{ id: 'a', translation: 'Hello' }, { id: 'b', translation: ' ' }], selectedEntryId: 'b' }
    const before = JSON.stringify(value)
    expect(localCoverage(value)).toEqual({ total: 2, translated: 1, percent: 50, complete: false, position: 2 })
    expect(JSON.stringify(value)).toBe(before)
  })
  it('handles legacy copies, missing selection and unexpected optional values', () => {
    expect(localCoverage(null)).toMatchObject({ total: 0, complete: false, position: 0 })
    expect(localCoverage({ entries: [null, { translation: 5 }] })).toMatchObject({ total: 2, translated: 0 })
    expect(localCoverage({ entries: [{ id: 'x', translation: 'ok' }], selectedEntryId: 'gone' })).toMatchObject({ position: 0, complete: true })
  })
  it('does not present empty or rounded-up partial coverage as completed', () => {
    expect(coverage(0, 0).complete).toBe(false)
    expect(coverage(1000, 999).complete).toBe(false)
    expect(coverage(1000, 999).percent).toBe(99)
    expect(coverage(5, 5).complete).toBe(true)
    expect(coverage(2, 9)).toMatchObject({ translated: 2, percent: 100 })
    expect(coverage(NaN, Infinity)).toMatchObject({ total: 0, percent: 0 })
    expect(coverage(-3, '2')).toMatchObject({ total: 0, translated: 0 })
  })
  it('stores only project IDs, scoped to each account', () => {
    const values = new Map()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
    rememberCloudProject('alice', 'one'); rememberCloudProject('bob', 'two')
    expect(lastCloudProject('alice')).toBe('one'); expect(lastCloudProject('bob')).toBe('two')
    expect(lastCloudProject('other')).toBeNull(); expect(lastCloudProject('')).toBeNull()
    expect([...values.values()]).toEqual(['one', 'two'])
  })
  it('does not block project loading when optional storage is denied', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } })
    expect(() => rememberCloudProject('alice', 'one')).not.toThrow()
    expect(lastCloudProject('alice')).toBeNull()
  })
})
