import { describe, expect, it } from 'vitest'
import { PROJECT_PALETTES, projectIdentity, projectInitials, stableProjectHash } from './projectIdentity'

describe('project identity', () => {
  it('is deterministic and constrained to the curated palette', () => {
    const first = projectIdentity('project-42', 'Friday Arabic')
    expect(projectIdentity('project-42', 'Friday Arabic')).toEqual(first)
    expect(PROJECT_PALETTES).toContainEqual({ accent: first.accent, soft: first.soft, ink: first.ink })
  })

  it('uses readable initials for filenames, names and empty labels', () => {
    expect(projectInitials('Friday Arabic')).toBe('FA')
    expect(projectInitials('dialogue.json')).toBe('DJ')
    expect(projectInitials('')).toBe('LH')
  })

  it('changes the hash when the stable seed changes', () => {
    expect(stableProjectHash('one')).not.toBe(stableProjectHash('two'))
  })
})
