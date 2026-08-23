import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  decodeLocalizationProject,
} from './projectModel'

describe(
  'decodeLocalizationProject',
  () => {
    it(
      'loads a v2 project without migration',
      () => {
        const result =
          decodeLocalizationProject(
            JSON.stringify({
              format:
                'LocalizationHubProject',

              version:
                2,

              sourceFileName:
                'game.json',

              selectedEntryId:
                'entry-1',

              tokenProfile:
                'generic',

              document: {
                parser:
                  'json',

                format:
                  'flat-json-object',

                sourceText:
                  '{}',
              },

              entries: [
                {
                  id:
                    'entry-1',

                  key:
                    'hello',

                  source:
                    'Hello',

                  translation:
                    '?????',

                  keyPath: [
                    'hello',
                  ],

                  sourcePath: [
                    'hello',
                  ],
                },
              ],
            }),
          )

        expect(result.ok)
          .toBe(true)

        if (!result.ok) {
          return
        }

        expect(
          result.migratedFromVersion,
        ).toBe(null)

        expect(
          result.project.version,
        ).toBe(2)

        expect(
          result.project.selectedEntryId,
        ).toBe('entry-1')
      },
    )

    it(
      'migrates a v1 project to v2',
      () => {
        const result =
          decodeLocalizationProject(
            JSON.stringify({
              format:
                'LocalizationHubProject',

              version:
                1,

              sourceFileName:
                'legacy.json',

              selectedKey:
                'bye',

              entries: [
                {
                  key:
                    'hello',

                  source:
                    'Hello',

                  translation:
                    '?????',
                },

                {
                  key:
                    'bye',

                  source:
                    'Goodbye',

                  translation:
                    '?? ???????',
                },
              ],
            }),
          )

        expect(result.ok)
          .toBe(true)

        if (!result.ok) {
          return
        }

        expect(
          result.migratedFromVersion,
        ).toBe(1)

        expect(
          result.project.version,
        ).toBe(2)

        expect(
          result.project.tokenProfile,
        ).toBe('generic')

        expect(
          result.project.entries[1].id,
        ).toBe('legacy:1:bye')

        expect(
          result.project.selectedEntryId,
        ).toBe('legacy:1:bye')

        expect(
          result.project.document.format,
        ).toBe('flat-json-object')
      },
    )

    it(
      'rejects invalid JSON',
      () => {
        expect(
          decodeLocalizationProject(
            '{broken',
          ),
        ).toEqual({
          ok:
            false,

          reason:
            'invalid-json',
        })
      },
    )

    it(
      'rejects an invalid project format',
      () => {
        expect(
          decodeLocalizationProject(
            JSON.stringify({
              format:
                'SomethingElse',

              version:
                2,

              entries: [
                {},
              ],
            }),
          ),
        ).toEqual({
          ok:
            false,

          reason:
            'invalid-format',
        })
      },
    )

    it(
      'rejects an empty project',
      () => {
        expect(
          decodeLocalizationProject(
            JSON.stringify({
              format:
                'LocalizationHubProject',

              version:
                2,

              entries: [],
            }),
          ),
        ).toEqual({
          ok:
            false,

          reason:
            'empty-project',
        })
      },
    )

    it(
      'rejects an unsupported version',
      () => {
        expect(
          decodeLocalizationProject(
            JSON.stringify({
              format:
                'LocalizationHubProject',

              version:
                99,

              entries: [
                {},
              ],
            }),
          ),
        ).toEqual({
          ok:
            false,

          reason:
            'unsupported-version',
        })
      },
    )
  },
)
