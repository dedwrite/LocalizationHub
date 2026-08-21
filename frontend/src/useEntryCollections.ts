import {
  useMemo,
} from 'react'

import type {
  ParsedLocalizationEntry,
} from './parsers'

type EntryFilter =
  | 'all'
  | 'untranslated'
  | 'translated'

type UseEntryCollectionsOptions = {
  entries:
    ParsedLocalizationEntry[]

  fullyProtectedEntryIds:
    Set<string>

  searchQuery:
    string

  entryFilter:
    EntryFilter
}

type EntryCollections = {
  translatedCount:
    number

  filteredEntries:
    ParsedLocalizationEntry[]

  navigableEntries:
    ParsedLocalizationEntry[]
}

/*
 * يجمع أغلب العمليات التي كانت
 * تمر على entries بشكل منفصل.
 *
 * سابقًا:
 *
 * translatedCount  -> loop
 * filteredEntries  -> loop
 * navigableEntries -> loop
 *
 * الآن:
 *
 * Loop واحد فقط.
 */
export function useEntryCollections({
  entries,
  fullyProtectedEntryIds,
  searchQuery,
  entryFilter,
}: UseEntryCollectionsOptions): EntryCollections {
  return useMemo(
    () => {
      let translatedCount =
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
         * نحسب المترجمة.
         */
        if (
          isTranslated
        ) {
          translatedCount +=
            1
        }

        /*
         * Filter status.
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
          )

        /*
         * إذا الـstatus filter
         * ما يطابق، ما فيه داعي
         * حتى نسوي search checks.
         */
        if (
          !matchesFilter
        ) {
          continue
        }

        /*
         * إذا ما فيه search،
         * ندخل الـEntry مباشرة.
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

        filteredEntries,

        navigableEntries,
      }
    },
    [
      entries,
      fullyProtectedEntryIds,
      searchQuery,
      entryFilter,
    ],
  )
}