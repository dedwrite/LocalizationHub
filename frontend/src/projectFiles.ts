import {
  writeTextFile,
} from '@tauri-apps/plugin-fs'

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

export async function writeLocalizationProject(
  path: string,
  project: LocalizationProjectV2,
): Promise<void> {
  const content =
    JSON.stringify(
      project,
      null,
      2,
    )

  await writeTextFile(
    path,
    content,
  )
}