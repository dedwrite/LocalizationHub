import {
  exportJsonLocalization,
} from './json'

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

    default:
      throw new Error(
        'Unsupported exporter.',
      )
  }
}