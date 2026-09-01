import { glossaryIssues, validateProtectedTokens, type TokenProfileId } from '@localizationhub/core'
import { lengthCue } from './textLength'
import { coverage } from './recents'

export type ChecklistSeverity = 'info' | 'warning' | 'ok'

export type ChecklistItem = {
  id: string
  severity: ChecklistSeverity
  count: number
}

export type ExportChecklist = {
  items: ChecklistItem[]
  blockers: number
  warnings: number
  ready: boolean
}

type EntryLike = {
  id?: string
  source?: string
  translation?: string
  key?: string
}

export function buildExportChecklist(input: {
  entries: EntryLike[]
  workflow?: Record<string, { status?: string } | undefined>
  glossary?: Array<{ sourceTerm: string; preferredTranslation: string; forbiddenTranslations: string[]; caseSensitive: boolean }>
  tokenProfileId?: TokenProfileId
}): ExportChecklist {
  const entries = input.entries ?? []
  const workflow = input.workflow ?? {}
  const glossary = input.glossary ?? []
  const profile = input.tokenProfileId ?? 'generic'

  let empty = 0
  let tokenProblems = 0
  let longUi = 0
  let needsReview = 0
  let glossaryProblems = 0

  for (const entry of entries) {
    const translation = typeof entry.translation === 'string' ? entry.translation : ''
    const source = typeof entry.source === 'string' ? entry.source : ''
    if (!translation.trim()) empty += 1
    const tokenResult = validateProtectedTokens(source, translation, profile)
    if ((tokenResult.missingTokens?.length ?? 0) > 0
      || (tokenResult.extraTokens?.length ?? 0) > 0
      || (tokenResult.errors?.length ?? 0) > 0
      || (tokenResult.warnings?.length ?? 0) > 0) {
      tokenProblems += 1
    }
    const cue = lengthCue(source, translation)
    if (cue.kind === 'long' || cue.kind === 'very-long') longUi += 1
    const status = workflow[entry.id ?? '']?.status
    if (status === 'needs-review') needsReview += 1
    if (glossaryIssues(source, translation, glossary).length > 0) glossaryProblems += 1
  }

  const counts = coverage(entries.length, entries.length - empty)
  const items: ChecklistItem[] = [
    { id: 'coverage', severity: counts.complete ? 'ok' : 'info', count: counts.translated },
    { id: 'empty', severity: empty > 0 ? 'warning' : 'ok', count: empty },
    { id: 'tokens', severity: tokenProblems > 0 ? 'warning' : 'ok', count: tokenProblems },
    { id: 'length', severity: longUi > 0 ? 'info' : 'ok', count: longUi },
    { id: 'review', severity: needsReview > 0 ? 'info' : 'ok', count: needsReview },
    { id: 'glossary', severity: glossaryProblems > 0 ? 'info' : 'ok', count: glossaryProblems },
  ]

  const warnings = items.filter((item) => item.severity === 'warning').length
  const blockers = 0
  return { items, blockers, warnings, ready: warnings === 0 && blockers === 0 }
}
