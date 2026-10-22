import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  parseLocalizationFile,
  validateProtectedTokens,
} from '@localizationhub/core'
import { landingSamples } from '../src/landingSamples'

describe('downloadable landing samples', () => {
  it.each(landingSamples)(
    '$format opens as three untranslated game entries',
    ({ href, format }) => {
      const source = readFileSync(
        new URL(`../public${href}`, import.meta.url),
        'utf8',
      )
      const result = parseLocalizationFile(source, href.split('/').at(-1)!)
      if (!result.ok) throw new Error(result.reason)
      expect(result.document.parser).toBe(
        format === 'PO' ? 'gettext-po' : format.toLowerCase(),
      )
      expect(result.document.entries.map((entry) => entry.source)).toEqual([
        'Start game',
        'Stay on this frequency, {player_name}.',
        'The <b>Relay Station</b> is transmitting.',
      ])
      expect(
        result.document.entries.every((entry) => entry.translation === ''),
      ).toBe(true)
      const dialogue = result.document.entries[1]
      expect(
        validateProtectedTokens(
          dialogue.source,
          'ابقَ على هذا التردد يا {player_name}.',
          'generic',
        ).hasErrors,
      ).toBe(false)
      expect(
        validateProtectedTokens(dialogue.source, 'اثبت.', 'generic').hasErrors,
      ).toBe(true)
    },
  )
})
