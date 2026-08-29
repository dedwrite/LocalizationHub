import type {
  TokenProfileId,
  TokenProfileConfig,
  TokenProfileDetection,
} from './tokens'
import { createTokenProfileConfig, detectionFromEngine } from './tokens'

import type {
  LocalizationFileFormat,
  LocalizationLanguageInfo,
  ParsedLocalizationEntry,
  RecordArraySchema,
} from './parsers'

import type {
  ProjectMetadata,
} from './projectMetadata'

export type StoredDocumentInfo = {
  parser: 'json' | 'csv' | 'gettext-po'

  format:
    LocalizationFileFormat

  sourceText:
    string

  schema?:
    RecordArraySchema

  language?:
    LocalizationLanguageInfo
}

export type EntryWorkflowStatus =
  | 'draft'
  | 'translated'
  | 'needs-review'
  | 'approved'

export type EffectiveEntryWorkflowStatus =
  | 'untranslated'
  | EntryWorkflowStatus

export type EntryWorkflowState = {
  status:
    EntryWorkflowStatus
}

export type EntryWorkflowMap =
  Record<
    string,
    EntryWorkflowState
  >

export type LocalizationProjectWorkflow = {
  entries:
    EntryWorkflowMap
}

export function getEffectiveEntryWorkflowStatus(
  entry:
    Pick<
      ParsedLocalizationEntry,
      'translation'
    >,
  workflowState?:
    EntryWorkflowState,
): EffectiveEntryWorkflowStatus {
  if (
    entry.translation
      .trim() === ''
  ) {
    return 'untranslated'
  }

  return (
    workflowState?.status ??
    'translated'
  )
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

  /** Additive profile state. `tokenProfile` remains for V3 compatibility. */
  tokenProfileConfig?: TokenProfileConfig
  engineDetection?: TokenProfileDetection

  document:
    StoredDocumentInfo

  entries:
    ParsedLocalizationEntry[]
}

export type LocalizationProjectV3 = {
  format:
    'LocalizationHubProject'

  version:
    3

  sourceFileName:
    string

  selectedEntryId:
    string | null

  tokenProfile:
    TokenProfileId

  tokenProfileConfig?: TokenProfileConfig
  engineDetection?: TokenProfileDetection

  document:
    StoredDocumentInfo

  entries:
    ParsedLocalizationEntry[]

  workflow:
    LocalizationProjectWorkflow

  metadata?:
    ProjectMetadata
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
      project: LocalizationProjectV3
      migratedFromVersion: 1 | 2 | null
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
): LocalizationProjectV3 {
  const entries: ParsedLocalizationEntry[] = legacy.entries.map(
    (entry, index) => ({
      id: `legacy:${index}:${entry.key}`,
      key: entry.key,
      source: entry.source,
      translation: entry.translation,
      keyPath: [entry.key],
      sourcePath: [entry.key],
    }),
  )

  const restored = entries.find((entry) => entry.key === legacy.selectedKey)

  return {
    format: 'LocalizationHubProject',
    version: 3,
    sourceFileName: legacy.sourceFileName,
    selectedEntryId: restored?.id ?? entries[0]?.id ?? null,
    tokenProfile: legacy.tokenProfile ?? 'generic',
    tokenProfileConfig: createTokenProfileConfig(legacy.tokenProfile ?? 'generic'),
    document: {
      parser: 'json',
      format: 'flat-json-object',
      sourceText: '',
      language: {
        sourceDirection: 'auto',
        translationDirection: 'auto',
      },
    },
    entries,
    workflow: { entries: {} },
    metadata: undefined,
  }
}

function migrateProjectV2(
  project: LocalizationProjectV2,
): LocalizationProjectV3 {
  return {
    ...project,
    version: 3,
    tokenProfileConfig: project.tokenProfileConfig ?? createTokenProfileConfig(project.tokenProfile),
    workflow: { entries: {} },
  }
}

function isValidWorkflow(
  value: unknown,
): value is LocalizationProjectWorkflow {
  if (!value || typeof value !== 'object') {
    return false
  }

  const entries = (value as { entries?: unknown }).entries
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return false
  }

  return Object.values(entries).every((state) => (
    Boolean(state) &&
    typeof state === 'object' &&
    ['draft', 'translated', 'needs-review', 'approved'].includes(
      (state as { status?: unknown }).status as string,
    )
  ))
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

  if (candidate.version === 3) {
    const project = parsed as Partial<LocalizationProjectV3>
    if (!isValidWorkflow(project.workflow)) {
      return { ok: false, reason: 'invalid-format' }
    }

    const profile = project.tokenProfile ?? 'generic'
    const authoritativeDetection = project.engineDetection
      ?? (project.metadata?.extraction ? detectionFromEngine({
        engine: project.metadata.extraction.engine,
        familyLabel: project.metadata.extraction.familyLabel,
        confidence: project.metadata.extraction.confidence,
        evidence: ['authoritative extraction metadata'],
      }) : undefined)
    const tokenProfileConfig = project.tokenProfileConfig ?? createTokenProfileConfig(
      profile,
      authoritativeDetection,
    )
    return {
      ok: true,
      project: {
        ...project,
        tokenProfile: profile,
        tokenProfileConfig,
        engineDetection: authoritativeDetection ?? tokenProfileConfig.detection,
      } as LocalizationProjectV3,
      migratedFromVersion: null,
    }
  }

  if (candidate.version === 2) {
    return {
      ok: true,
      project: migrateProjectV2(parsed as LocalizationProjectV2),
      migratedFromVersion: 2,
    }
  }

  if (candidate.version === 1) {
    return {
      ok: true,
      project: migrateProjectV1(parsed as LocalizationProjectV1),
      migratedFromVersion: 1,
    }
  }

  return {
    ok: false,
    reason:
      'unsupported-version',
  }
}
