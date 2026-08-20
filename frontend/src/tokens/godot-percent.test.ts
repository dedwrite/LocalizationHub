import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  extractGodotTokens,
} from './godot'

describe(
  'Godot percent references',
  () => {
    it(
      'detects character references',
      () => {
        const tokens =
          extractGodotTokens(
            '%Mark talks to %Louise.',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '%Mark',
          '%Louise',
        ])
      },
    )

    it(
      'detects underscore variable references',
      () => {
        const tokens =
          extractGodotTokens(
            'Hello %player_name.',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '%player_name',
        ])
      },
    )

    it(
      'keeps printf placeholders as format tokens',
      () => {
        const tokens =
          extractGodotTokens(
            'Name: %s | Count: %d | Position: %v',
          )

        expect(
          tokens.map(
            (token) => ({
              raw:
                token.raw,

              kind:
                token.kind,
            }),
          ),
        ).toEqual([
          {
            raw: '%s',
            kind: 'format',
          },

          {
            raw: '%d',
            kind: 'format',
          },

          {
            raw: '%v',
            kind: 'format',
          },
        ])
      },
    )

    it(
      'does not mistake a percentage word for a variable',
      () => {
        const tokens =
          extractGodotTokens(
            'Get 100%discount today.',
          )

        expect(
          tokens,
        ).toHaveLength(0)
      },
    )

    it(
      'detects percent references next to normal dialogue',
      () => {
        const tokens =
          extractGodotTokens(
            'Hey %Mark, are you okay?',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '%Mark',
        ])
      },
    )
  },
)