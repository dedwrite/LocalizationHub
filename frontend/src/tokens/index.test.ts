import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  validateProtectedTokens,
} from './index'

describe(
  'LocalizationHub Token Guard',
  () => {
    it(
      'accepts plain text without tokens',
      () => {
        const result =
          validateProtectedTokens(
            'Hello world',
            'مرحبًا بالعالم',
          )

        expect(
          result.isValid,
        ).toBe(true)

        expect(
          result.sourceTokens,
        ).toHaveLength(0)

        expect(
          result.translationTokens,
        ).toHaveLength(0)
      },
    )

    it(
      'accepts a variable that stays in the middle',
      () => {
        const result =
          validateProtectedTokens(
            'Recovers {Common.Energy} randomly',
            'يستعيد {Common.Energy} بشكل عشوائي',
          )

        expect(
          result.isValid,
        ).toBe(true)

        expect(
          result.placementIssues,
        ).toHaveLength(0)
      },
    )

    it(
      'detects a middle variable moved to the end',
      () => {
        const result =
          validateProtectedTokens(
            'Recovers {Common.Energy} randomly',
            'يستعيد بشكل عشوائي {Common.Energy}',
          )

        expect(
          result.isValid,
        ).toBe(false)

        expect(
          result.placementIssues.some(
            (issue) =>
              issue.kind ===
              'token-placement-changed',
          ),
        ).toBe(true)
      },
    )

    it(
      'accepts a leading placeholder that stays leading',
      () => {
        const result =
          validateProtectedTokens(
            '{0} Chance to double materials',
            '{0} فرصة لمضاعفة المواد',
          )

        expect(
          result.isValid,
        ).toBe(true)
      },
    )

    it(
      'detects a missing placeholder',
      () => {
        const result =
          validateProtectedTokens(
            'Hello {0}',
            'مرحبًا',
          )

        expect(
          result.isValid,
        ).toBe(false)

        expect(
          result.missingTokens,
        ).toHaveLength(1)

        expect(
          result.missingTokens[0].raw,
        ).toBe('{0}')
      },
    )

    it(
      'detects an unexpected extra placeholder',
      () => {
        const result =
          validateProtectedTokens(
            'Hello',
            'مرحبًا {0}',
          )

        expect(
          result.isValid,
        ).toBe(false)

        expect(
          result.extraTokens,
        ).toHaveLength(1)

        expect(
          result.extraTokens[0].raw,
        ).toBe('{0}')
      },
    )

    it(
      'detects token order changes',
      () => {
        const result =
          validateProtectedTokens(
            '{0} gave {1}',
            '{1} أعطى {0}',
          )

        expect(
          result.isValid,
        ).toBe(false)

        expect(
          result.placementIssues.some(
            (issue) =>
              issue.kind ===
              'token-order-changed',
          ),
        ).toBe(true)
      },
    )

    it(
      'accepts a paired color tag with equivalent scope',
      () => {
        const result =
          validateProtectedTokens(
            'Ellie has <color=#800000>gotten much closer</color> after the chat.',
            'لقد <color=#800000>أصبحت إيلي أقرب بكثير</color> بعد المحادثة.',
          )

        expect(
          result.isValid,
        ).toBe(true)

        expect(
          result.structureIssues,
        ).toHaveLength(0)

        expect(
          result.placementIssues,
        ).toHaveLength(0)
      },
    )

    it(
      'detects an empty paired tag',
      () => {
        const result =
          validateProtectedTokens(
            'I shall come [em1]during the day[/em1].',
            'سآتي خلال النهار.[em1][/em1]',
          )

        expect(
          result.isValid,
        ).toBe(false)

        expect(
          result.structureIssues.some(
            (issue) =>
              issue.kind ===
              'tag-content-empty',
          ),
        ).toBe(true)
      },
    )

    it(
      'detects a middle tag expanded over the entire translation',
      () => {
        const result =
          validateProtectedTokens(
            'Ellie has <color=#800000>gotten much closer</color> after the chat.',
            '<color=#800000>لقد أصبحت إيلي أقرب بكثير بعد المحادثة.</color>',
          )

        expect(
          result.isValid,
        ).toBe(false)

        expect(
          result.placementIssues.some(
            (issue) =>
              issue.kind ===
              'tag-scope-changed',
          ),
        ).toBe(true)
      },
    )

    it(
      'detects closing and opening tags in the wrong order',
      () => {
        const result =
          validateProtectedTokens(
            'Hello <color=#800000>world</color> again.',
            'مرحبًا </color>بالعالم<color=#800000> مجددًا.',
          )

        expect(
          result.isValid,
        ).toBe(false)

        expect(
          result.structureIssues.some(
            (issue) =>
              issue.kind ===
              'tag-structure-invalid',
          ),
        ).toBe(true)

        expect(
          result.placementIssues.some(
            (issue) =>
              issue.kind ===
              'token-order-changed',
          ),
        ).toBe(true)
      },
    )

    it(
      'accepts correctly nested tags',
      () => {
        const result =
          validateProtectedTokens(
            '<b>Hello <i>world</i></b>',
            '<b>مرحبًا <i>بالعالم</i></b>',
          )

        expect(
          result.isValid,
        ).toBe(true)

        expect(
          result.structureIssues,
        ).toHaveLength(0)
      },
    )

    it(
      'detects broken nested tag structure',
      () => {
        const result =
          validateProtectedTokens(
            '<b>Hello <i>world</i></b>',
            '<b>مرحبًا <i>بالعالم</b></i>',
          )

        expect(
          result.isValid,
        ).toBe(false)

        expect(
          result.structureIssues.some(
            (issue) =>
              issue.kind ===
              'tag-structure-invalid',
          ),
        ).toBe(true)
      },
    )
  },
)