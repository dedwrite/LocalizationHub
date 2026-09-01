import { describe, expect, it } from 'vitest'
import { lengthCue, measureLength } from './textLength'

describe('textLength', () => {
  it('measures visible characters without collapsing meaning', () => {
    expect(measureLength('hello')).toBe(5)
    expect(measureLength('مرحبا')).toBe(5)
  })

  it('classifies empty, short, balanced, long and very-long translations', () => {
    expect(lengthCue('Open settings', '').kind).toBe('empty')
    expect(lengthCue('Open settings', 'Go').kind).toBe('short')
    expect(lengthCue('Open settings', 'Open settings').kind).toBe('balanced')
    expect(lengthCue('OK', 'Confirm this choice now').kind).toBe('very-long')
    expect(lengthCue('Hello world', 'Hello world today').kind).toBe('long')
  })
})
