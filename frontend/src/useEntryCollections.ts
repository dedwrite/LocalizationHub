import {
  useMemo,
} from 'react'

import {
  matchesSearch as matchesStructuredSearch,
  parseSearchQuery,
  getEffectiveEntryWorkflowStatus,
} from '@localizationhub/core'

import type {
  EntryWorkflowMap,
  EffectiveEntryWorkflowStatus,
  ParsedLocalizationEntry,
} from '@localizationhub/core'

export type EntryFilter =
  | 'all'
  | 'untranslated'
  | 'translated'
  | 'errors'
  | 'warnings'
  | 'needs-review'
  | 'draft'
  | 'approved'

type UseEntryCollectionsOptions = {
  entries:
    ParsedLocalizationEntry[]

  fullyProtectedEntryIds:
    Set<string>

  errorEntryIds:
    Set<string>

  warningEntryIds:
    Set<string>

  needsReviewEntryIds:
    Set<string>

  workflowEntries:
    EntryWorkflowMap

  projectMetadata:
    import('@localizationhub/core').ProjectMetadata

  currentUserId?:
    string

  searchQuery:
    string

  entryFilter:
    EntryFilter
}

type EntryCollections = {
  translatedCount:
    number

  errorCount:
    number

  warningCount:
    number

  needsReviewCount:
    number

  workflowCounts:
    Record<EffectiveEntryWorkflowStatus, number>

  filteredEntries:
    ParsedLocalizationEntry[]

  navigableEntries:
    ParsedLocalizationEntry[]
}

export function useEntryCollections({
  entries,
  fullyProtectedEntryIds,
  errorEntryIds,
  warningEntryIds,
  needsReviewEntryIds,
  workflowEntries,
  projectMetadata,
  currentUserId,
  searchQuery,
  entryFilter,
}: UseEntryCollectionsOptions): EntryCollections {
  return useMemo(
    () => {
      let translatedCount =
        0

      let errorCount =
        0

      let warningCount =
        0

      let needsReviewCount =
        0

      const workflowCounts: Record<EffectiveEntryWorkflowStatus, number> = {
        untranslated: 0,
        draft: 0,
        translated: 0,
        'needs-review': 0,
        approved: 0,
      }

      const filteredEntries:
        ParsedLocalizationEntry[] =
          []

      const navigableEntries:
        ParsedLocalizationEntry[] =
          []

      const normalizedSearch =
        searchQuery
          .trim()
          .toLowerCase()

          const structuredSearch = parseSearchQuery(searchQuery)

      for (
        const entry
        of entries
      ) {
        const isProtected =
          fullyProtectedEntryIds.has(
            entry.id,
          )

        const isTranslated =
          !isProtected &&
          entry.translation
            .trim() !== ''

        const workflowStatus = getEffectiveEntryWorkflowStatus(
          entry,
          workflowEntries[entry.id],
        )
        workflowCounts[workflowStatus] += 1

        const hasError =
          errorEntryIds.has(
            entry.id,
          )

        const hasWarning =
          warningEntryIds.has(
            entry.id,
          )

        const needsReview =
          needsReviewEntryIds.has(
            entry.id,
          )

        if (!matchesStructuredSearch(entry, structuredSearch, workflowEntries, projectMetadata, errorEntryIds, warningEntryIds, currentUserId)) continue

        /*
         * كل Entry غير Protected
         * تدخل التنقل العادي.
         */
        if (
          !isProtected
        ) {
          navigableEntries.push(
            entry,
          )
        }

        /*
         * Progress.
         *
         * حتى لو فيها Error أو Warning،
         * ما زالت تحتوي ترجمة.
         */
        if (
          isTranslated
        ) {
          translatedCount +=
            1
        }

        /*
         * Review counters.
         */
        if (
          hasError
        ) {
          errorCount +=
            1
        }

        if (
          hasWarning
        ) {
          warningCount +=
            1
        }

        if (
          needsReview
        ) {
          needsReviewCount +=
            1
        }

        /*
         * Filters.
         */
        const matchesFilter =
          entryFilter ===
            'all' ||
          (
            entryFilter ===
              'translated' &&
            isTranslated
          ) ||
          (
            entryFilter ===
              'untranslated' &&
            !isProtected &&
            !isTranslated
          ) ||
          (
            entryFilter ===
              'errors' &&
            hasError
          ) ||
          (
            entryFilter ===
              'warnings' &&
            hasWarning
          ) ||
          (
            entryFilter ===
              'needs-review' &&
            workflowStatus === 'needs-review'
          ) ||
          (
            (entryFilter === 'draft' || entryFilter === 'approved') &&
            workflowStatus === entryFilter
          )

        if (
          !matchesFilter
        ) {
          continue
        }

        /*
         * بدون Search:
         * نضيف مباشرة.
         */
        if (
          !normalizedSearch
        ) {
          filteredEntries.push(
            entry,
          )

          continue
        }

        const context =
          entry.context ??
          ''

        const notes =
          entry.notes ??
          ''

        const matchesSearch =
          entry.key
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          entry.source
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          entry.translation
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          context
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          notes
            .toLowerCase()
            .includes(
              normalizedSearch,
            )

        if (
          matchesSearch
        ) {
          filteredEntries.push(
            entry,
          )
        }
      }

      return {
        translatedCount,

        errorCount,

        warningCount,

        needsReviewCount,

        workflowCounts,

        filteredEntries,

        navigableEntries,
      }
    },
    [
      entries,
      fullyProtectedEntryIds,
      errorEntryIds,
      warningEntryIds,
      needsReviewEntryIds,
      workflowEntries,
      projectMetadata,
      currentUserId,
      searchQuery,
      entryFilter,
    ],
  )
}