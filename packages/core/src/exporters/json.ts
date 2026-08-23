import {
  parse as parseLosslessJson,
  stringify as stringifyLosslessJson,
} from 'lossless-json'

import type {
  JsonPathSegment,
  ParsedLocalizationDocument,
  ParsedLocalizationEntry,
} from '@localizationhub/core'

type JsonContainer =
  | Record<string, unknown>
  | unknown[]

function isContainer(
  value: unknown,
): value is JsonContainer {
  return (
    value !== null &&
    typeof value === 'object'
  )
}

function setValueAtPath(
  root: unknown,
  path: JsonPathSegment[],
  value: string,
): void {
  if (path.length === 0) {
    throw new Error(
      'Cannot write to an empty JSON path.',
    )
  }

  let current: unknown = root

  for (
    let index = 0;
    index < path.length - 1;
    index += 1
  ) {
    if (!isContainer(current)) {
      throw new Error(
        `Invalid export path at segment ${index}.`,
      )
    }

    const segment = path[index]

    current =
      Array.isArray(current)
        ? current[Number(segment)]
        : current[String(segment)]
  }

  if (!isContainer(current)) {
    throw new Error(
      'Invalid destination container.',
    )
  }

  const finalSegment =
    path[path.length - 1]

  if (Array.isArray(current)) {
    current[Number(finalSegment)] =
      value
  } else {
    current[String(finalSegment)] =
      value
  }
}

function getExportValue(
  entry: ParsedLocalizationEntry,
  useSourceWhenEmpty: boolean,
): string {
  if (
    entry.translation.trim() !== ''
  ) {
    return entry.translation
  }

  return useSourceWhenEmpty
    ? entry.source
    : entry.translation
}

export function exportJsonLocalization(
  document: ParsedLocalizationDocument,
): string {
  if (!document.sourceText) {
    throw new Error(
      'The original JSON source is not available for export.',
    )
  }

  const root =
    parseLosslessJson(
      document.sourceText,
    )

  if (document.format === 'flat-json-object') {
    for (const entry of document.entries) {
      /*
       * Flat JSON:
       *
       * {
       *   "KEY": "text"
       * }
       *
       * نفس الحقل هو النص النهائي،
       * لذلك نستبدله بالترجمة.
       *
       * إذا ما ترجمناه بعد، نبقي
       * النص الأصلي بدل إخراج قيمة فارغة.
       */
      setValueAtPath(
        root,
        entry.sourcePath,
        getExportValue(
          entry,
          true,
        ),
      )
    }
  }

  if (document.format === 'json-record-array') {
    for (const entry of document.entries) {
      /*
       * Record Array:
       *
       * source: "English"
       * arabic: "..."
       *
       * هنا لا نلمس source ولا أي
       * metadata. نعدّل حقل الترجمة فقط.
       */
      if (!entry.translationPath) {
        continue
      }

      setValueAtPath(
        root,
        entry.translationPath,
        entry.translation,
      )
    }
  }

  const output =
    stringifyLosslessJson(
      root,
      null,
      2,
    )

  if (typeof output !== 'string') {
    throw new Error(
      'Failed to serialize exported JSON.',
    )
  }

  return output
}