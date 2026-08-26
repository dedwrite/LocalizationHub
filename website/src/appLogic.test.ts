import { describe, expect, it } from 'vitest'
import { canEdit, markRevisionConflict, setEntryStatus, setEntryTranslation } from './appLogic'

const project = { entries: [{ id: 'entry-1', translation: '' }], workflow: { entries: {} } }

describe('web app editor logic', () => {
  it('allows only owner and editor writes', () => {
    expect(canEdit('owner')).toBe(true)
    expect(canEdit('editor')).toBe(true)
    expect(canEdit('viewer')).toBe(false)
  })

  it('updates translation and workflow without mutating the source project', () => {
    const translated = setEntryTranslation(project, 0, 'Hello')
    const reviewed = setEntryStatus(translated, 'entry-1', 'needs-review')
    expect(project.entries[0].translation).toBe('')
    expect(reviewed.entries[0].translation).toBe('Hello')
    expect(reviewed.workflow.entries['entry-1'].status).toBe('needs-review')
  })

  it('marks a revision conflict without overwriting the revision', () => {
    expect(markRevisionConflict({ revision: 7, conflict: false })).toEqual({ revision: 7, conflict: true })
  })
})
