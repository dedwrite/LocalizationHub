import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  isFullyProtectedText,
} from './protection'

describe(
  'Fully protected localization text',
  () => {
    it(
      'marks dollar command lines as fully protected',
      () => {
        expect(
          isFullyProtectedText(
            '$ play_anim CharacterA idle',
            'godot',
          ),
        ).toBe(true)
      },
    )

    it(
      'marks double-colon commands as fully protected',
      () => {
        expect(
          isFullyProtectedText(
            ':: wait',
            'godot',
          ),
        ).toBe(true)
      },
    )

    it(
      'marks divert commands as fully protected',
      () => {
        expect(
          isFullyProtectedText(
            '-> next_scene',
            'godot',
          ),
        ).toBe(true)
      },
    )

    it(
      'marks standalone control markers as fully protected',
      () => {
        expect(
          isFullyProtectedText(
            '[...]',
            'godot',
          ),
        ).toBe(true)
      },
    )

    it(
      'does not mark inline commands inside dialogue as fully protected',
      () => {
        expect(
          isFullyProtectedText(
            'Hello [$ F CharacterA concerned] there.',
            'godot',
          ),
        ).toBe(false)
      },
    )

    it(
      'does not mark variables inside dialogue as fully protected',
      () => {
        expect(
          isFullyProtectedText(
            'Hello %CharacterA.',
            'godot',
          ),
        ).toBe(false)
      },
    )

    it(
      'does not mark normal dialogue as fully protected',
      () => {
        expect(
          isFullyProtectedText(
            'Hello there.',
            'godot',
          ),
        ).toBe(false)
      },
    )
  },
)