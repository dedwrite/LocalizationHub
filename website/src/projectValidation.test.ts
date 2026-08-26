import { describe, expect, it } from 'vitest'
import { validateProjectV3 } from './workspace/projectValidation'

describe('validateProjectV3', () => {
  const valid = () => ({
    format: 'LocalizationHubProject',
    version: 3,
    sourceFileName: 'game.json',
    entries: [{ id: 'e0', key: 'k', source: 's', translation: 't' }],
    workflow: { entries: {} },
  })

  it('accepts a valid Project V3', () => {
    expect(validateProjectV3(valid())).toEqual({ ok: true })
  })

  it('rejects a function payload (the updater serialization bug)', () => {
    expect(validateProjectV3(() => {})).toMatchObject({ ok: false })
  })

  it('rejects null and non-object payloads', () => {
    expect(validateProjectV3(null)).toMatchObject({ ok: false })
    expect(validateProjectV3('nope')).toMatchObject({ ok: false })
    expect(validateProjectV3([])).toMatchObject({ ok: false })
  })

  it('rejects wrong format or version', () => {
    expect(validateProjectV3({ ...valid(), format: 'Other' })).toMatchObject({ ok: false })
    expect(validateProjectV3({ ...valid(), version: 2 })).toMatchObject({ ok: false })
  })

  it('rejects missing entries or workflow', () => {
    const noEntries = valid() as any
    delete noEntries.entries
    expect(validateProjectV3(noEntries)).toMatchObject({ ok: false })

    const noWorkflow = valid() as any
    delete noWorkflow.workflow
    expect(validateProjectV3(noWorkflow)).toMatchObject({ ok: false })
  })

  it('rejects an invalid workflow status (never persist untranslated)', () => {
    const bad = valid()
    bad.workflow.entries = { e0: { status: 'untranslated' } }
    expect(validateProjectV3(bad)).toMatchObject({ ok: false })
  })

  it('accepts valid persisted workflow statuses', () => {
    const good = valid()
    good.workflow.entries = { e0: { status: 'approved' }, e1: { status: 'needs-review' } }
    expect(validateProjectV3(good)).toEqual({ ok: true })
  })
})
