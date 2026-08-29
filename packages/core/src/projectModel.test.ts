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
      'migrates a v2 project to v3',
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

        expect(result.migratedFromVersion).toBe(2)

        expect(
          result.project.version,
        ).toBe(3)

        expect(result.project.workflow.entries).toEqual({})

        expect(
          result.project.selectedEntryId,
        ).toBe('entry-1')
      },
    )

    it(
      'migrates a v1 project to v3',
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
        ).toBe(3)

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

    it(
      'rejects malformed v3 workflow data',
      () => {
        expect(
          decodeLocalizationProject(
            JSON.stringify({
              format: 'LocalizationHubProject',
              version: 3,
              entries: [{ id: 'entry-1' }],
              workflow: { entries: { 'entry-1': { status: 'unknown' } } },
            }),
          ),
        ).toEqual({ ok: false, reason: 'invalid-format' })
      },
    )

    it(
      'loads a native v3 project without migration',
      () => {
        const result = decodeLocalizationProject(JSON.stringify({
          format: 'LocalizationHubProject',
          version: 3,
          sourceFileName: 'game.json',
          selectedEntryId: 'entry-1',
          tokenProfile: 'generic',
          document: { parser: 'json', format: 'flat-json-object', sourceText: '{}' },
          entries: [{ id: 'entry-1', key: 'hello', source: 'Hello', translation: 'مرحبا', keyPath: ['hello'], sourcePath: ['hello'] }],
          workflow: { entries: { 'entry-1': { status: 'approved' } } },
        }))
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.migratedFromVersion).toBe(null)
          expect(result.project.workflow.entries['entry-1'].status).toBe('approved')
        }
      },
    )

    it('preserves an old explicit Godot choice as manual', () => {
      const result = decodeLocalizationProject(JSON.stringify({
        format: 'LocalizationHubProject', version: 3, sourceFileName: 'game.json', selectedEntryId: 'e',
        tokenProfile: 'godot', document: { parser: 'json', format: 'flat-json-object', sourceText: '{}' },
        entries: [{ id: 'e', key: 'hello', source: 'Hello', translation: '', keyPath: ['hello'], sourcePath: ['hello'] }],
        workflow: { entries: {} },
      }))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.project.tokenProfileConfig?.mode).toBe('manual')
        expect(result.project.tokenProfileConfig?.selectedProfile).toBe('godot')
      }
    })

    it('round-trips Auto with a separate resolved profile and detection', () => {
      const result = decodeLocalizationProject(JSON.stringify({
        format: 'LocalizationHubProject', version: 3, sourceFileName: 'game.json', selectedEntryId: 'e',
        tokenProfile: 'auto', tokenProfileConfig: {
          mode: 'auto', resolvedProfile: 'unity', detection: { engine: 'unity', confidence: 'high', evidence: ['metadata'] },
        }, engineDetection: { engine: 'unity', confidence: 'high', evidence: ['metadata'] },
        document: { parser: 'json', format: 'flat-json-object', sourceText: '{}' },
        entries: [{ id: 'e', key: 'hello', source: 'Hello', translation: '', keyPath: ['hello'], sourcePath: ['hello'] }],
        workflow: { entries: {} },
      }))
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.project.tokenProfileConfig?.resolvedProfile).toBe('unity')
    })
  },
)
