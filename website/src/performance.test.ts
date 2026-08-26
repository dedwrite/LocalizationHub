import { describe, expect, it } from 'vitest'
import { filterEntries } from './appLogic'
import { projectStats } from './appApi'

describe('large project performance regression', () => {
  it('filters and calculates statistics for 10,000 entries within practical bounds', () => {
    const entries = Array.from({ length: 10_000 }, (_, index) => ({ id: `entry-${index}`, key: `menu.${index}`, source: `Source ${index}`, translation: index % 2 ? '' : `Translation ${index}` }))
    const start = performance.now()
    const filtered = filterEntries(entries, 'status:draft menu.99', {})
    const filteredMs = performance.now() - start
    const statsStart = performance.now()
    const stats = projectStats({ entries, workflow: { entries: {} } })
    const statsMs = performance.now() - statsStart
    expect(filtered).toHaveLength(56)
    expect(stats.total).toBe(10_000)
    expect(filteredMs).toBeLessThan(500)
    expect(statsMs).toBeLessThan(500)
  })
})
