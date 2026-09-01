import { describe, expect, it } from 'vitest'
import { projectIdentity } from './projectIdentity'

describe('projectIdentity', () => {
  it('is stable for the same name', () => {
    expect(projectIdentity('Ni no Kuni')).toEqual(projectIdentity('Ni no Kuni'))
    expect(projectIdentity('Ni no Kuni')).toEqual(projectIdentity('  ni no kuni  '))
  })

  it('varies across different names and keeps a glyph', () => {
    const a = projectIdentity('Alpha Quest')
    const b = projectIdentity('Beta Quest')
    expect(a.glyph).toBeTruthy()
    expect(b.glyph).toBeTruthy()
    expect(a.accent).toMatch(/^#/)
    expect([a.tone, b.tone].every((tone) => tone >= 0 && tone < 8)).toBe(true)
  })

  it('uses Arabic letters for Arabic titles', () => {
    expect(projectIdentity('مشروع تعريب').glyph).toBe('م')
  })
})
