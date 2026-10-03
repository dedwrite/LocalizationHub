/*
 * Entry collection / filtering / QA derivation for the Web Workspace.
 *
 * Reuses @localizationhub/core for workflow status and protected-token
 * validation so Web and Desktop share the same authoritative behavior.
 */
import { duplicateTranslationIssue, getEffectiveEntryWorkflowStatus, translationQaIssues, validateProtectedTokens, type EntryWorkflowMap, type TokenProfileId } from '@localizationhub/core'

export type BulkSelection = Set<number>

export type EntryFilterId =
  | 'all'
  | 'untranslated'
  | 'draft'
  | 'translated'
  | 'needs-review'
  | 'approved'
  | 'errors'
  | 'warnings'
  | 'comments'
  | 'assigned-to-me'
  | 'tags'

export type EntryFilter = { id: EntryFilterId; label: string; primary?: boolean }

export const ENTRY_FILTERS: EntryFilter[] = [
  { id: 'all', label: 'All', primary: true },
  { id: 'untranslated', label: 'Untranslated', primary: true },
  { id: 'translated', label: 'Translated', primary: true },
  { id: 'needs-review', label: 'Needs Review', primary: true },
  { id: 'errors', label: 'Errors', primary: true },
  { id: 'draft', label: 'Draft' },
  { id: 'approved', label: 'Approved' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'comments', label: 'Has Comments' },
  { id: 'assigned-to-me', label: 'Assigned to Me' },
  { id: 'tags', label: 'Has Tags' },
]

export type EntryIssue = { severity: 'error' | 'warning'; message: string; kind?: string; token?: { raw: string }; detail?: string }

export type EntryView = {
  entry: any
  index: number
  status: string
  issues: EntryIssue[]
  hasError: boolean
  hasWarning: boolean
}

export function entryStatus(entry: any, workflow: EntryWorkflowMap): string {
  return getEffectiveEntryWorkflowStatus(entry, workflow[entry.id])
}

export function entryIssues(entry: any, tokenProfileId: TokenProfileId = 'generic', duplicateOf?: string): EntryIssue[] {
  // Unstarted entries belong in Untranslated, not in the live error queue.
  // Export validation remains strict and still checks the original project.
  if (!entry.translation?.trim()) return []
  const result = validateProtectedTokens(entry.source ?? '', entry.translation ?? '', tokenProfileId)
  const issues: EntryIssue[] = []
  for (const token of result.missingTokens ?? []) issues.push({ severity: 'error', kind: 'missing', token, message: `Missing protected token: ${token.raw}` })
  for (const token of result.extraTokens ?? []) issues.push({ severity: 'error', kind: 'extra', token, message: `Unexpected protected token: ${token.raw}` })
  issues.push(...result.errors, ...result.warnings)
  // The translation's own quality checks: numbers, line breaks, punctuation,
  // edge spaces, invisible characters and entities the source carried.
  for (const issue of translationQaIssues(entry.source ?? '', entry.translation ?? '', tokenProfileId)) {
    issues.push({ severity: issue.severity, kind: issue.kind, detail: issue.detail, message: issue.message })
  }
  if (duplicateOf) {
    const duplicate = duplicateTranslationIssue(duplicateOf)
    issues.push({ severity: duplicate.severity, kind: duplicate.kind, detail: duplicate.detail, message: duplicate.message })
  }
  return issues
}

export type EntryCollection = {
  views: EntryView[]
  counts: Record<string, number>
  total: number
}

export type CollectionOptions = {
  entries: any[]
  workflow: EntryWorkflowMap
  filter: EntryFilterId
  query: string
  tokenProfileId?: TokenProfileId
  commentEntryIds?: Set<string>
  assignedEntryIds?: Set<string>
  taggedEntryIds?: Set<string>
  currentUserId?: string
  assignments?: Record<string, string | null>
  duplicateTranslationIds?: Map<string, string>
}

function matchesQuery(view: EntryView, rawQuery: string): boolean {
  const { entry, status } = view
  const text = rawQuery.trim().toLowerCase()
  if (!text) return true
  const parts = text.split(/\s+/u).filter(Boolean)
  const haystack = `${entry.id} ${entry.key ?? ''} ${entry.source ?? ''} ${entry.translation ?? ''} ${entry.context ?? ''} ${entry.notes ?? ''}`.toLowerCase()
  return parts.every((part) => {
    const [key, value] = part.split(':', 2)
    if (key === 'status') return value === undefined || status === value
    if (key === 'untranslated') return !entry.translation
    if (key === 'translated') return Boolean(entry.translation)
    return haystack.includes(part)
  })
}

function matchesFilter(view: EntryView, options: CollectionOptions): boolean {
  const { filter, commentEntryIds, assignedEntryIds, taggedEntryIds, currentUserId, assignments } = options
  switch (filter) {
    case 'all': return true
    case 'untranslated': return view.status === 'untranslated'
    case 'draft': return view.status === 'draft'
    case 'translated': return view.status === 'translated'
    case 'needs-review': return view.status === 'needs-review'
    case 'approved': return view.status === 'approved'
    case 'errors': return view.hasError
    case 'warnings': return view.hasWarning
    case 'comments': return commentEntryIds ? commentEntryIds.has(view.entry.id) : false
    case 'tags': return taggedEntryIds ? taggedEntryIds.has(view.entry.id) : false
    case 'assigned-to-me':
      if (!currentUserId) return false
      if (assignments) return assignments[view.entry.id] === currentUserId
      return assignedEntryIds ? assignedEntryIds.has(view.entry.id) : false
    default: return true
  }
}

export function buildEntryCollection(options: CollectionOptions): EntryCollection {
  const { entries, workflow, tokenProfileId } = options
  const views: EntryView[] = []
  const counts: Record<string, number> = {
    total: entries.length, untranslated: 0, draft: 0, translated: 0, 'needs-review': 0, approved: 0, errors: 0, warnings: 0, comments: 0, 'assigned-to-me': 0, tags: 0,
  }

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    const status = entryStatus(entry, workflow)
    const issues = entryIssues(entry, tokenProfileId, options.duplicateTranslationIds?.get(entry.id))
    const view: EntryView = { entry, index, status, issues, hasError: issues.some((i) => i.severity === 'error'), hasWarning: issues.some((i) => i.severity === 'warning') }
    counts[status] = (counts[status] ?? 0) + 1
    if (view.hasError) counts.errors += 1
    if (view.hasWarning) counts.warnings += 1
    if (options.taggedEntryIds?.has(entry.id)) counts.tags += 1
    if (options.commentEntryIds?.has(entry.id)) counts.comments += 1
    if (options.currentUserId && (options.assignments ? options.assignments[entry.id] === options.currentUserId : options.assignedEntryIds?.has(entry.id))) counts['assigned-to-me'] += 1
    views.push(view)
  }

  const filtered = views.filter((view) => matchesQuery(view, options.query) && matchesFilter(view, options))
  return { views: filtered, counts, total: entries.length }
}

export function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/u).length : 0
}
