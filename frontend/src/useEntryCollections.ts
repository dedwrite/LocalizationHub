import {
  useMemo,
} from 'react'

import type {
  ParsedLocalizationEntry,
} from './parsers'

export type EntryFilter =
  | 'all'
  | 'untranslated'
  | 'translated'
  | 'needs-review'

type UseEntryCollectionsOptions = {
  entries:
    ParsedLocalizationEntry[]

  fullyProtectedEntryIds:
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

  needsReviewCount:
    number

  filteredEntries:
    ParsedLocalizationEntry[]

  navigableEntries:
    ParsedLocalizationEntry[]
}

/*
 * Loop واحد فقط على Entries.
 *
 * يحسب:
 *
 * - translatedCount
 * - needsReviewCount
 * - filteredEntries
 * - navigableEntries
 *
 * بدون ما نسوي validation هنا.
 *
 * Needs Review جاي جاهز من
 * useNeedsReviewEntryIds.
 */
export function useEntryCollections({
  entries,
  fullyProtectedEntryIds,
  needsReviewEntryIds,
  searchQuery,
  entryFilter,
}: UseEntryCollectionsOptions): EntryCollections {
  return useMemo(
    () => {
      let translatedCount =
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

        const needsReview =
          needsReviewEntryIds.has(
            entry.id,
          )

        /*
         * كل Entry غير محمية
         * تدخل في التنقل.
         */
        if (
          !isProtected
        ) {
          navigableEntries.push(
            entry,
          )
        }

        /*
         * أي Entry عندها ترجمة
         * تدخل translatedCount
         * حتى لو تحتاج مراجعة.
         */
        if (
          isTranslated
        ) {
          translatedCount +=
            1
        }

        if (
          needsReview
        ) {
          needsReviewCount +=
            1
        }

        /*
         * Status filter.
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
              'needs-review' &&
            needsReview
          )

        if (
          !matchesFilter
        ) {
          continue
        }

        /*
         * ما فيه Search؟
         * ندخل مباشرة.
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
          entry.context ?? ''

        const notes =
          entry.notes ?? ''

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

        needsReviewCount,

        filteredEntries,

        navigableEntries,
      }
    },
    [
      entries,
      fullyProtectedEntryIds,
      needsReviewEntryIds,
      searchQuery,
      entryFilter,
    ],
  )
}