import {
  useMemo,
} from 'react'

import type {
  ParsedLocalizationEntry,
} from '@localizationhub/core'

export type EntryFilter =
  | 'all'
  | 'untranslated'
  | 'translated'
  | 'errors'
  | 'warnings'
  | 'needs-review'

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
            needsReview
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
      searchQuery,
      entryFilter,
    ],
  )
}