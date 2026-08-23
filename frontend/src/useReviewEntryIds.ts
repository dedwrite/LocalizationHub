import {
  useMemo,
  useRef,
} from 'react'

import type {
  ParsedLocalizationEntry,
} from '@localizationhub/core'

import {
  validateProtectedTokens,
  type TokenProfileId,
} from '@localizationhub/core'

type CachedReviewState = {
  source:
    string

  translation:
    string

  tokenProfile:
    TokenProfileId

  hasErrors:
    boolean

  hasWarnings:
    boolean
}

export type ReviewEntryIds = {
  errorEntryIds:
    Set<string>

  warningEntryIds:
    Set<string>

  needsReviewEntryIds:
    Set<string>
}

/*
 * Cached review validation.
 *
 * الهدف:
 *
 * - ما نعيد validate لكل Entry
 *   مع كل حرف.
 *
 * - Entry المتغيرة فقط هي اللي
 *   تحتاج فحص جديد.
 *
 * - Errors و Warnings منفصلة.
 *
 * ملاحظة:
 *
 * Entry فيها Error + Warning
 * نحسبها Error فقط في العدادات،
 * حتى ما تظهر مرتين للمستخدم.
 *
 * لكنها تظل موجودة طبعًا داخل
 * Needs Review.
 */
export function useReviewEntryIds(
  entries:
    ParsedLocalizationEntry[],

  fullyProtectedEntryIds:
    Set<string>,

  tokenProfile:
    TokenProfileId,
): ReviewEntryIds {
  const cacheRef =
    useRef(
      new Map<
        string,
        CachedReviewState
      >(),
    )

  return useMemo(
    () => {
      const errorEntryIds =
        new Set<string>()

      const warningEntryIds =
        new Set<string>()

      const needsReviewEntryIds =
        new Set<string>()

      const activeEntryIds =
        new Set<string>()

      for (
        const entry
        of entries
      ) {
        activeEntryIds.add(
          entry.id,
        )

        /*
         * Fully Protected entries
         * عندها guard منفصل.
         */
        if (
          fullyProtectedEntryIds.has(
            entry.id,
          )
        ) {
          cacheRef.current.set(
            entry.id,
            {
              source:
                entry.source,

              translation:
                entry.translation,

              tokenProfile,

              hasErrors:
                false,

              hasWarnings:
                false,
            },
          )

          continue
        }

        /*
         * Untranslated entries
         * ليست Review issue.
         */
        if (
          entry.translation
            .trim() === ''
        ) {
          cacheRef.current.set(
            entry.id,
            {
              source:
                entry.source,

              translation:
                entry.translation,

              tokenProfile,

              hasErrors:
                false,

              hasWarnings:
                false,
            },
          )

          continue
        }

        const cached =
          cacheRef.current.get(
            entry.id,
          )

        let hasErrors:
          boolean

        let hasWarnings:
          boolean

        const cacheMatches =
          cached &&
          cached.source ===
            entry.source &&
          cached.translation ===
            entry.translation &&
          cached.tokenProfile ===
            tokenProfile

        if (
          cacheMatches
        ) {
          hasErrors =
            cached.hasErrors

          hasWarnings =
            cached.hasWarnings
        } else {
          const validation =
            validateProtectedTokens(
              entry.source,
              entry.translation,
              tokenProfile,
            )

          hasErrors =
            validation.hasErrors

          hasWarnings =
            validation.hasWarnings

          cacheRef.current.set(
            entry.id,
            {
              source:
                entry.source,

              translation:
                entry.translation,

              tokenProfile,

              hasErrors,

              hasWarnings,
            },
          )
        }

        if (
          hasErrors
        ) {
          errorEntryIds.add(
            entry.id,
          )

          needsReviewEntryIds.add(
            entry.id,
          )

          /*
           * Error له الأولوية.
           *
           * حتى لو عنده Warning أيضًا،
           * ما نضيفه إلى warningEntryIds.
           */
          continue
        }

        if (
          hasWarnings
        ) {
          warningEntryIds.add(
            entry.id,
          )

          needsReviewEntryIds.add(
            entry.id,
          )
        }
      }

      /*
       * تنظيف Cache من Entries
       * لم تعد موجودة.
       */
      for (
        const cachedId
        of cacheRef.current.keys()
      ) {
        if (
          !activeEntryIds.has(
            cachedId,
          )
        ) {
          cacheRef.current.delete(
            cachedId,
          )
        }
      }

      return {
        errorEntryIds,
        warningEntryIds,
        needsReviewEntryIds,
      }
    },
    [
      entries,
      fullyProtectedEntryIds,
      tokenProfile,
    ],
  )
}