import {
  exportJsonLocalization,
} from './json'
import { exportCsvLocalization } from '../parsers/csv'
import { exportPoLocalization } from '../parsers/po'

import type {
  ParsedLocalizationDocument,
} from '@localizationhub/core'

export function exportLocalizationDocument(
  document: ParsedLocalizationDocument,
): string {
  switch (document.parser) {
    case 'json':
      return exportJsonLocalization(
        document,
      )

    case 'csv':
      return exportCsvLocalization(document)

    case 'gettext-po':
      return exportPoLocalization(document)

    default:
      throw new Error(
        'Unsupported exporter.',
      )
  }
}