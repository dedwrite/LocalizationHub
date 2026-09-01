import { describe, expect, it } from 'vitest'
import { greetingKey } from './AmbientGreeting'

function at(day: number, hour: number) {
  const date = new Date(2026, 8, 6 + day, hour)
  Object.defineProperty(date, 'getDay', { value: () => day })
  return date
}

describe('ambient greeting', () => {
  it('uses calm time-aware copy and keeps Friday night special', () => {
    expect(greetingKey(at(1, 9))).toBe('delight.greetingMorning')
    expect(greetingKey(at(2, 15))).toBe('delight.greetingAfternoon')
    expect(greetingKey(at(3, 20))).toBe('delight.greetingEvening')
    expect(greetingKey(at(4, 1))).toBe('delight.greetingLate')
    expect(greetingKey(at(5, 20))).toBe('delight.greetingFriday')
  })
})
