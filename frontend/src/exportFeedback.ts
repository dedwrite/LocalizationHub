import type { ParsedLocalizationDocument } from '@localizationhub/core'
import { translate, type MessageKey } from '@localizationhub/i18n'

const successKeys = {
  json: 'desktop.jsonExported',
  csv: 'desktop.csvExported',
  'gettext-po': 'desktop.poExported',
} satisfies Record<ParsedLocalizationDocument['parser'], MessageKey>

export function exportSuccessMessage(
  parser: ParsedLocalizationDocument['parser'],
) {
  // The desktop bridge looks up English text. Read it from the catalog so
  // the toast and its Arabic lookup can never drift apart.
  return translate('en', successKeys[parser])
}
