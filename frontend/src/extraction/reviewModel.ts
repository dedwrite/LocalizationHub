/*
 * Pure, UI-independent review model.
 *
 * The Extraction Review has three expensive/behavioural concerns that are kept
 * here (no React, no DOM) so they can be unit-tested and memoized cleanly:
 *
 *   - entry filtering (filter + search + source exclusion)
 *   - per-filter counts (so filter chips can show "Dialogue 27,415")
 *   - source-language preview (overrideSourceCulture, non-destructive)
 *   - source grouping (for the Sources panel)
 *   - diagnostics categorization (so Diagnostics can show Errors/Warnings/
 *     Unsupported with severity, without re-running extraction)
 */

import {
  REVIEW_FILTERS,
  matchesReviewFilter,
  overrideSourceCulture,
  type ReviewFilterId,
} from '@localizationhub/core'
import type {
  ExtractedEntry,
  ExtractionDiagnostic,
} from '@localizationhub/core'

export function filterEntries(
  entries: ExtractedEntry[],
  filter: ReviewFilterId,
  search: string,
  excludedFiles: Set<string>,
): ExtractedEntry[] {
  const text = search.trim().toLowerCase()
  return entries.filter((entry) => {
    if (excludedFiles.has(entry.origin.containerPath ?? '')) return false
    if (!matchesReviewFilter(entry, filter)) return false
    if (!text) return true
    return (
      entry.sourceText.toLowerCase().includes(text) ||
      (entry.key ?? '').toLowerCase().includes(text) ||
      (entry.context?.speaker ?? '').toLowerCase().includes(text)
    )
  })
}

export function computeFilterCounts(
  entries: ExtractedEntry[],
  excludedFiles: Set<string>,
): Record<ReviewFilterId, number> {
  const counts = {} as Record<ReviewFilterId, number>
  for (const id of REVIEW_FILTERS.map((f) => f.id)) counts[id] = 0
  for (const entry of entries) {
    if (excludedFiles.has(entry.origin.containerPath ?? '')) continue
    for (const { id } of REVIEW_FILTERS) {
      if (matchesReviewFilter(entry, id)) counts[id] += 1
    }
  }
  return counts
}

export function computeIncludedExcluded(
  entries: ExtractedEntry[],
  excludedIds: Set<string>,
  excludedFiles: Set<string>,
): { included: number; excluded: number } {
  let included = 0
  for (const entry of entries) {
    if (excludedIds.has(entry.id)) continue
    if (excludedFiles.has(entry.origin.containerPath ?? '')) continue
    included += 1
  }
  return { included, excluded: entries.length - included }
}

export type SourceGroup = {
  path: string
  count: number
  excluded: boolean
  /* Dominant content audience of the source (editor/test vs runtime). */
  audience?: string
  /* Human-readable exclusion reason when the source is editor/test tooling. */
  exclusionReason?: string
}

export function groupSources(
  entries: ExtractedEntry[],
  excludedFiles: Set<string>,
): SourceGroup[] {
  const map = new Map<string, { count: number; audiences: Map<string, number>; reason?: string }>()
  for (const entry of entries) {
    const path = entry.origin.containerPath ?? '(unknown)'
    const item = map.get(path) ?? { count: 0, audiences: new Map<string, number>() }
    item.count += 1
    const audience = entry.contentAudience ?? 'runtime'
    item.audiences.set(audience, (item.audiences.get(audience) ?? 0) + 1)
    if (entry.exclusionReason) item.reason = entry.exclusionReason
    map.set(path, item)
  }
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([path, item]) => {
      let audience = 'runtime'
      let best = 0
      for (const [a, count] of item.audiences) {
        if (count > best) {
          best = count
          audience = a
        }
      }
      return { path, count: item.count, excluded: excludedFiles.has(path), audience, exclusionReason: item.reason }
    })
}

/*
 * Counts of auto-excluded (developer/editor/test) vs runtime vs uncertain
 * entries, used for the review's secondary stats.
 */
export function computeAudienceCounts(entries: ExtractedEntry[]): {
  developerExcluded: number
  runtime: number
  uncertain: number
} {
  let developerExcluded = 0
  let runtime = 0
  let uncertain = 0
  for (const entry of entries) {
    if (entry.excludedByDefault) developerExcluded += 1
    else if (entry.contentAudience === 'unknown') uncertain += 1
    else runtime += 1
  }
  return { developerExcluded, runtime, uncertain }
}

export function previewSourceCulture(
  entries: ExtractedEntry[],
  locale: string | undefined,
): ExtractedEntry[] {
  if (!locale) return entries
  return overrideSourceCulture(entries, locale)
}

export type DiagnosticSeverity = 'error' | 'warning' | 'unsupported' | 'info'

const ERROR_KINDS = new Set([
  'parser-error',
  'corrupt-resource',
  'encrypted-container',
  'external-tool-failed',
  'missing-key',
  'missing-companion-file',
  'missing-type-tree',
  'unsupported-engine-version',
])

const WARNING_KINDS = new Set(['low-confidence', 'partial-extraction'])

export type DiagnosticGroup = {
  kind: string
  message: string
  severity: DiagnosticSeverity
  count: number
  path?: string
  examplePaths: string[]
}

export function severityOf(kind: string): DiagnosticSeverity {
  if (ERROR_KINDS.has(kind)) return 'error'
  if (WARNING_KINDS.has(kind)) return 'warning'
  if (kind === 'cancelled' || kind === 'locale-structure-mismatch' || kind === 'structural-skipped') return 'info'
  return 'unsupported'
}

export function categorizeDiagnostics(diagnostics: ExtractionDiagnostic[]): DiagnosticGroup[] {
  return diagnostics.map((d) => ({
    kind: d.kind,
    message: d.message,
    severity: severityOf(d.kind),
    count: d.count ?? 1,
    path: d.path,
    examplePaths: d.examplePaths ?? (d.path ? [d.path] : []),
  }))
}

export type DiagnosticSummary = {
  groups: number
  errors: number
  warnings: number
  unsupported: number
  files: number
}

export function summarizeDiagnostics(groups: DiagnosticGroup[]): DiagnosticSummary {
  let errors = 0
  let warnings = 0
  let unsupported = 0
  let files = 0
  for (const g of groups) {
    if (g.severity === 'error') errors += g.count
    else if (g.severity === 'warning') warnings += g.count
    else if (g.severity === 'unsupported') unsupported += g.count
    files += g.count
  }
  return { groups: groups.length, errors, warnings, unsupported, files }
}
