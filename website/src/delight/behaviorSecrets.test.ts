import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverBehaviorSecret, fridayNightComplete, lateNightHour, markSecretSeen, secretSeen, sundayDaytimeComplete } from './behaviorSecrets'

afterEach(() => vi.unstubAllGlobals())

describe('behaviorSecrets', () => {
  it('detects Friday-night completion windows', () => {
    expect(fridayNightComplete(new Date('2026-09-04T20:00:00'))).toBe(true)
    expect(fridayNightComplete(new Date('2026-09-05T02:00:00'))).toBe(true)
    expect(fridayNightComplete(new Date('2026-09-04T12:00:00'))).toBe(false)
  })

  it('detects Sunday daytime completion windows', () => {
    expect(sundayDaytimeComplete(new Date('2026-09-06T11:00:00'))).toBe(true)
    expect(sundayDaytimeComplete(new Date('2026-09-06T07:00:00'))).toBe(false)
    expect(sundayDaytimeComplete(new Date('2026-09-05T11:00:00'))).toBe(false)
  })

  it('discovers rare secrets once and respects storage', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    })
    const friday = discoverBehaviorSecret({
      complete: true,
      now: new Date('2026-09-04T21:15:00'),
    })
    expect(friday?.id).toBe('fridayComplete')
    markSecretSeen('fridayComplete')
    expect(secretSeen('fridayComplete')).toBe(true)
    expect(discoverBehaviorSecret({
      complete: true,
      now: new Date('2026-09-04T21:15:00'),
    })).toBeNull()
    const sunday = discoverBehaviorSecret({
      complete: true,
      now: new Date('2026-09-06T11:00:00'),
    })
    expect(sunday?.id).toBe('sundayComplete')
    markSecretSeen('sundayComplete')
    expect(discoverBehaviorSecret({
      complete: true,
      now: new Date('2026-09-06T11:00:00'),
    })).toBeNull()
    expect(lateNightHour(new Date('2026-09-01T02:00:00'))).toBe(true)
    const late = discoverBehaviorSecret({
      complete: false,
      justSaved: true,
      now: new Date('2026-09-01T02:00:00'),
    })
    expect(late?.id).toBe('lateNightSave')
  })
})
