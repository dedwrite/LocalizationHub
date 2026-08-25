import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isValidCloudProjectV3 } from '../cloud-project-validation.mjs'

const valid = { format: 'LocalizationHubProject', version: 3, sourceFileName: 'strings.json', entries: [{ id: 'entry-1', translation: '' }], workflow: { entries: {} } }

describe('Cloud V3 trust-boundary validation', () => {
  it('accepts the minimum valid V3 shape', () => assert.equal(isValidCloudProjectV3(valid), true))
  it('rejects old, empty, malformed, and invalid workflow projects', () => {
    for (const project of [
      { ...valid, version: 2 },
      { ...valid, entries: [] },
      { ...valid, entries: [{ id: 'entry-1' }] },
      { ...valid, workflow: undefined },
      { ...valid, workflow: { entries: [] } },
      { ...valid, workflow: { entries: { 'entry-1': { status: 'bad' } } } },
      null,
      [],
    ]) assert.equal(isValidCloudProjectV3(project), false)
  })
})
