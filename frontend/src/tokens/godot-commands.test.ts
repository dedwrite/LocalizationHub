import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  extractGodotTokens,
} from './godot'

describe(
  'Godot engine command protection',
  () => {
    it(
      'protects dollar command lines',
      () => {
        const tokens =
          extractGodotTokens(
            '$ say_timed 2.0',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '$ say_timed 2.0',
        ])

        expect(
          tokens[0].kind,
        ).toBe(
          'control-code',
        )
      },
    )

    it(
      'protects animation command lines',
      () => {
        const tokens =
          extractGodotTokens(
            '$ play_anim CharacterA idle',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '$ play_anim CharacterA idle',
        ])
      },
    )

    it(
      'protects double-colon command lines',
      () => {
        const tokens =
          extractGodotTokens(
            ':: wait',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          ':: wait',
        ])
      },
    )

    it(
      'protects divert command lines',
      () => {
        const tokens =
          extractGodotTokens(
            '-> next_scene',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '-> next_scene',
        ])
      },
    )

    it(
      'protects commands inside multiline text',
      () => {
        const tokens =
          extractGodotTokens(
            [
              'Normal dialogue.',
              ':: wait',
              'More dialogue.',
              '$ play_anim CharacterA happy',
            ].join('\n'),
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          ':: wait',
          '$ play_anim CharacterA happy',
        ])
      },
    )

    it(
      'does not mistake normal dialogue containing dollar signs for commands',
      () => {
        const tokens =
          extractGodotTokens(
            'This item costs $20.',
          )

        expect(
          tokens,
        ).toHaveLength(0)
      },
    )

    it(
      'does not mistake normal arrows inside dialogue for command lines',
      () => {
        const tokens =
          extractGodotTokens(
            'Go left -> then turn right.',
          )

        expect(
          tokens,
        ).toHaveLength(0)
      },
    )
  },
)