import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  extractGodotTokens,
} from './godot'

describe(
  'Godot Token Profile',
  () => {
    it(
      'detects Godot vector placeholders',
      () => {
        const tokens =
          extractGodotTokens(
            'Position: %v',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '%v',
        ])
      },
    )

    it(
      'detects dynamic padding placeholders as one token',
      () => {
        const tokens =
          extractGodotTokens(
            'Value: %*.*f',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '%*.*f',
        ])
      },
    )

    it(
      'detects zero dynamic padding placeholders',
      () => {
        const tokens =
          extractGodotTokens(
            'Value: %0*d',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '%0*d',
        ])
      },
    )

    it(
      'detects escaped percent signs',
      () => {
        const tokens =
          extractGodotTokens(
            'Health: %d%%',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '%d',
          '%%',
        ])
      },
    )

    it(
      'detects empty String.format placeholders',
      () => {
        const tokens =
          extractGodotTokens(
            'Hello {}!',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '{}',
        ])
      },
    )

    it(
      'inherits named String.format placeholders from Generic',
      () => {
        const tokens =
          extractGodotTokens(
            'Hello {player}!',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '{player}',
        ])
      },
    )

    it(
      'inherits Godot BBCode from Generic',
      () => {
        const tokens =
          extractGodotTokens(
            'Hello [color=red]world[/color]',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '[color=red]',
          '[/color]',
        ])
      },
    )

    it(
      'detects ellipsis control markers',
      () => {
        const tokens =
          extractGodotTokens(
            "It's like...[...] life's moving pretty fast.",
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '[...]',
        ])

        expect(
          tokens[0].kind,
        ).toBe(
          'control-code',
        )
      },
    )

    it(
      'detects punctuation control markers',
      () => {
        const tokens =
          extractGodotTokens(
            'Wait [!] [---] [???]',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '[!]',
          '[---]',
          '[???]',
        ])
      },
    )

    it(
      'does not classify word brackets as punctuation control markers',
      () => {
        const tokens =
          extractGodotTokens(
            '[Chapter]',
          )

        const controlTokens =
          tokens.filter(
            (token) =>
              token.kind ===
              'control-code',
          )

        expect(
          controlTokens,
        ).toHaveLength(0)
      },
    )

    it(
      'detects inline dollar commands as one protected token',
      () => {
        const tokens =
          extractGodotTokens(
            'Granny and [$ F CelestLazaro concerned] loved going on afternoon walks.',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '[$ F CelestLazaro concerned]',
        ])

        expect(
          tokens[0].kind,
        ).toBe(
          'control-code',
        )
      },
    )

    it(
      'detects inline D commands',
      () => {
        const tokens =
          extractGodotTokens(
            'Hello [$ D some_internal_value] world.',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '[$ D some_internal_value]',
        ])
      },
    )

    it(
      'keeps quoted inline command content inside one token',
      () => {
        const tokens =
          extractGodotTokens(
            'Hello [$ F "concerned expression"] world.',
          )

        expect(
          tokens.map(
            (token) =>
              token.raw,
          ),
        ).toEqual([
          '[$ F "concerned expression"]',
        ])
      },
    )
  },
)