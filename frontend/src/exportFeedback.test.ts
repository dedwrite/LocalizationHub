import { describe, expect, it } from 'vitest'
import { parseLocalizationFile } from '@localizationhub/core'
import { translateUiText } from '@localizationhub/i18n'
import { exportSuccessMessage } from './exportFeedback'

describe('desktop export confirmations', () => {
  it.each([
    [
      'sample.json',
      '{"menu.start":"Start"}',
      'JSON file exported.',
      'صُدّر ملف JSON.',
    ],
    [
      'sample.csv',
      'key,source,translation\nmenu.start,Start,ابدأ\n',
      'CSV file exported.',
      'صُدّر ملف CSV.',
    ],
    [
      'sample.po',
      'msgid "Start"\nmsgstr "ابدأ"\n',
      'gettext PO file exported.',
      'صُدّر ملف gettext PO.',
    ],
    [
      'sample.pot',
      'msgid "Start"\nmsgstr ""\n',
      'gettext PO file exported.',
      'صُدّر ملف gettext PO.',
    ],
  ])(
    'names the parsed format of %s in both interface languages',
    (name, source, english, arabic) => {
      const result = parseLocalizationFile(source, name)
      if (!result.ok) throw new Error(result.reason)
      const message = exportSuccessMessage(result.document.parser)
      expect(message).toBe(english)
      expect(translateUiText('ar', message)).toBe(arabic)
      expect(translateUiText('en', message)).toBe(english)
    },
  )
})
