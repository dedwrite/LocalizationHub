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
          result.hasErrors,
        ).toBe(false)

        expect(
          result.hasWarnings,
        ).toBe(false)

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
          result.hasErrors,
        ).toBe(false)

        expect(
          result.hasWarnings,
        ).toBe(false)
      },
    )

    it(
      'warns when a middle variable moves to the end',
      () => {
        const result =
          validateProtectedTokens(
            'Recovers {Common.Energy} randomly',
            'يستعيد بشكل عشوائي {Common.Energy}',
          )

        /*
         * Placement changes are warnings,
         * not blocking errors.
         */
        expect(
          result.isValid,
        ).toBe(true)

        expect(
          result.hasErrors,
        ).toBe(false)

        expect(
          result.hasWarnings,
        ).toBe(true)

        expect(
          result.warnings.some(
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

        expect(
          result.hasWarnings,
        ).toBe(false)
      },
    )

    it(
      'treats a missing placeholder as an error',
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
          result.hasErrors,
        ).toBe(true)

        expect(
          result.missingTokens,
        ).toHaveLength(1)

        expect(
          result.missingTokens[0].raw,
        ).toBe('{0}')
      },
    )

    it(
      'treats an unexpected extra placeholder as an error',
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
          result.hasErrors,
        ).toBe(true)

        expect(
          result.extraTokens,
        ).toHaveLength(1)

        expect(
          result.extraTokens[0].raw,
        ).toBe('{0}')
      },
    )

    it(
      'warns when token order changes',
      () => {
        const result =
          validateProtectedTokens(
            '{0} gave {1}',
            '{1} أعطى {0}',
          )

        expect(
          result.isValid,
        ).toBe(true)

        expect(
          result.hasErrors,
        ).toBe(false)

        expect(
          result.hasWarnings,
        ).toBe(true)

        expect(
          result.warnings.some(
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
          result.hasErrors,
        ).toBe(false)

        expect(
          result.hasWarnings,
        ).toBe(false)

        expect(
          result.structureIssues,
        ).toHaveLength(0)

        expect(
          result.placementIssues,
        ).toHaveLength(0)
      },
    )

    it(
      'treats an empty paired tag as an error',
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
          result.hasErrors,
        ).toBe(true)

        expect(
          result.errors.some(
            (issue) =>
              issue.kind ===
              'tag-content-empty',
          ),
        ).toBe(true)
      },
    )

    it(
      'warns when a middle tag expands over the entire translation',
      () => {
        const result =
          validateProtectedTokens(
            'Ellie has <color=#800000>gotten much closer</color> after the chat.',
            '<color=#800000>لقد أصبحت إيلي أقرب بكثير بعد المحادثة.</color>',
          )

        /*
         * Scope changes are suspicious,
         * but may be linguistically valid.
         */
        expect(
          result.isValid,
        ).toBe(true)

        expect(
          result.hasErrors,
        ).toBe(false)

        expect(
          result.hasWarnings,
        ).toBe(true)

        expect(
          result.warnings.some(
            (issue) =>
              issue.kind ===
              'tag-scope-changed',
          ),
        ).toBe(true)
      },
    )

    it(
      'treats reversed closing and opening tags as an error',
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
          result.hasErrors,
        ).toBe(true)

        expect(
          result.errors.some(
            (issue) =>
              issue.kind ===
              'tag-structure-invalid',
          ),
        ).toBe(true)

        /*
         * Order may additionally produce
         * a warning, but the structural
         * error is what blocks validity.
         */
        expect(
          result.warnings.some(
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
          result.hasErrors,
        ).toBe(false)

        expect(
          result.structureIssues,
        ).toHaveLength(0)
      },
    )

    it(
      'treats broken nested tag structure as an error',
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
          result.hasErrors,
        ).toBe(true)

        expect(
          result.errors.some(
            (issue) =>
              issue.kind ===
              'tag-structure-invalid',
          ),
        ).toBe(true)
      },
    )
  },
)