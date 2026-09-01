import { describe, expect, it } from 'vitest'
import { buildExportChecklist } from './exportChecklist'

describe('buildExportChecklist', () => {
  it('counts empty entries, review states and length expansion', () => {
    const checklist = buildExportChecklist({
      entries: [
        { id: '1', source: 'OK', translation: '' },
        { id: '2', source: 'Save', translation: 'Save the current adventure progress now' },
        { id: '3', source: 'Hello', translation: 'Hello' },
      ],
      workflow: {
        '3': { status: 'needs-review' },
      },
      glossary: [],
      tokenProfileId: 'generic',
    })
    expect(checklist.items.find((item) => item.id === 'empty')?.count).toBe(1)
    expect(checklist.items.find((item) => item.id === 'length')?.count).toBe(1)
    expect(checklist.items.find((item) => item.id === 'review')?.count).toBe(1)
    expect(checklist.warnings).toBeGreaterThan(0)
  })
})
