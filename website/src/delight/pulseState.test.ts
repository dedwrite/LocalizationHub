import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasProgressPulse, loadProgressPulse, recordProgressPulse } from './pulseState'

afterEach(() => vi.unstubAllGlobals())

describe('pulseState', () => {
  it('records session and day deltas in sessionStorage', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    })
    const first = recordProgressPulse({ becameTranslated: true })
    expect(first.sessionTranslated).toBe(1)
    expect(first.translatedDelta).toBe(1)
    const second = recordProgressPulse({ becameApproved: true })
    expect(second.sessionApproved).toBe(1)
    expect(hasProgressPulse(loadProgressPulse())).toBe(true)
  })
})
