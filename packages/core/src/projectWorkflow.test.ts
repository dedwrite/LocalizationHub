import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  getEffectiveEntryWorkflowStatus,
} from './projectModel'

describe(
  'getEffectiveEntryWorkflowStatus',
  () => {
    it(
      'treats an empty translation as untranslated',
      () => {
        expect(
          getEffectiveEntryWorkflowStatus(
            {
              translation:
                '   ',
            },
            {
              status:
                'approved',
            },
          ),
        ).toBe(
          'untranslated',
        )
      },
    )

    it(
      'defaults translated text to translated',
      () => {
        expect(
          getEffectiveEntryWorkflowStatus(
            {
              translation:
                'Translated text',
            },
          ),
        ).toBe(
          'translated',
        )
      },
    )

    it(
      'uses an explicit workflow status',
      () => {
        expect(
          getEffectiveEntryWorkflowStatus(
            {
              translation:
                'Translated text',
            },
            {
              status:
                'needs-review',
            },
          ),
        ).toBe(
          'needs-review',
        )
      },
    )

    it(
      'allows approved translated text',
      () => {
        expect(
          getEffectiveEntryWorkflowStatus(
            {
              translation:
                'Translated text',
            },
            {
              status:
                'approved',
            },
          ),
        ).toBe(
          'approved',
        )
      },
    )
  },
)
