import type {
  TokenProfileId,
} from './tokens'

import type {
  LocalizationFileFormat,
  LocalizationLanguageInfo,
  ParsedLocalizationEntry,
  RecordArraySchema,
} from './parsers'

export type StoredDocumentInfo = {
  parser: 'json'

  format:
    LocalizationFileFormat

  sourceText:
    string

  schema?:
    RecordArraySchema

  language?:
    LocalizationLanguageInfo
}

export type LocalizationProjectV2 = {
  format:
    'LocalizationHubProject'

  version:
    2

  sourceFileName:
    string

  selectedEntryId:
    string | null

  tokenProfile:
    TokenProfileId

  document:
    StoredDocumentInfo

  entries:
    ParsedLocalizationEntry[]
}

export type LegacyTranslationEntry = {
  key:
    string

  source:
    string

  translation:
    string
}

export type LocalizationProjectV1 = {
  format:
    'LocalizationHubProject'

  version:
    1

  sourceFileName:
    string

  selectedKey:
    string | null

  tokenProfile?:
    TokenProfileId

  entries:
    LegacyTranslationEntry[]
}

export type DecodeLocalizationProjectResult =
  | {
      ok: true

      project:
        LocalizationProjectV2

      migratedFromVersion:
        1 | null
    }
  | {
      ok: false

      reason:
        | 'invalid-json'
        | 'invalid-format'
        | 'empty-project'
        | 'unsupported-version'
    }

function migrateProjectV1(
  legacy: LocalizationProjectV1,
): LocalizationProjectV2 {
  const entries:
    ParsedLocalizationEntry[] =
      legacy.entries.map(
        (
          entry,
          index,
        ) => ({
          id:
            `legacy:${index}:${entry.key}`,

          key:
            entry.key,

          source:
            entry.source,

          translation:
            entry.translation,

          keyPath: [
            entry.key,
          ],

          sourcePath: [
            entry.key,
          ],
        }),
      )

  const restored =
    entries.find(
      (entry) =>
        entry.key ===
        legacy.selectedKey,
    )

  return {
    format:
      'LocalizationHubProject',

    version:
      2,

    sourceFileName:
      legacy.sourceFileName,

    selectedEntryId:
      restored?.id ??
      entries[0]?.id ??
      null,

    tokenProfile:
      legacy.tokenProfile ??
      'generic',

    document: {
      parser:
        'json',

      format:
        'flat-json-object',

      sourceText:
        '',

      language: {
        sourceDirection:
          'auto',

        translationDirection:
          'auto',
      },
    },

    entries,
  }
}

export function decodeLocalizationProject(
  content: string,
): DecodeLocalizationProjectResult {
  let parsed:
    unknown

  try {
    parsed =
      JSON.parse(content)
  } catch {
    return {
      ok: false,
      reason:
        'invalid-json',
    }
  }

  if (
    !parsed ||
    typeof parsed !== 'object'
  ) {
    return {
      ok: false,
      reason:
        'invalid-format',
    }
  }

  const candidate =
    parsed as {
      format?:
        unknown

      version?:
        unknown

      entries?:
        unknown
    }

  if (
    candidate.format !==
    'LocalizationHubProject'
  ) {
    return {
      ok: false,
      reason:
        'invalid-format',
    }
  }

  if (
    !Array.isArray(
      candidate.entries,
    ) ||
    candidate.entries.length === 0
  ) {
    return {
      ok: false,
      reason:
        'empty-project',
    }
  }

  if (
    candidate.version === 2
  ) {
    return {
      ok: true,

      project:
        parsed as
          LocalizationProjectV2,

      migratedFromVersion:
        null,
    }
  }

  if (
    candidate.version === 1
  ) {
    return {
      ok: true,

      project:
        migrateProjectV1(
          parsed as
            LocalizationProjectV1,
        ),

      migratedFromVersion:
        1,
    }
  }

  return {
    ok: false,
    reason:
      'unsupported-version',
  }
}
