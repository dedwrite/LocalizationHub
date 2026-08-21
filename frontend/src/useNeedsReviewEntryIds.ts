import {
  useMemo,
  useRef,
} from 'react'

import type {
  ParsedLocalizationEntry,
} from './parsers'

import {
  validateProtectedTokens,
  type TokenProfileId,
} from './tokens'

type ReviewCacheEntry = {
  source: string

  translation: string

  tokenProfile:
    TokenProfileId

  needsReview:
    boolean
}

/*
 * يحسب الـEntries التي تحتاج مراجعة:
 *
 * - عندها Translation
 * - ليست Fully Protected
 * - فيها Token Error أو Warning
 *
 * والنتائج تُحفظ في Cache،
 * لذلك عند تعديل Entry واحدة
 * لا نعيد validation لآلاف النصوص.
 */
export function useNeedsReviewEntryIds(
  entries:
    ParsedLocalizationEntry[],

  fullyProtectedEntryIds:
    Set<string>,

  tokenProfile:
    TokenProfileId,
): Set<string> {
  const cacheRef =
    useRef(
      new Map<
        string,
        ReviewCacheEntry
      >(),
    )

  return useMemo(
    () => {
      const needsReviewIds =
        new Set<string>()

      const activeIds =
        new Set<string>()

      const cache =
        cacheRef.current

      for (
        const entry
        of entries
      ) {
        activeIds.add(
          entry.id,
        )

        const isProtected =
          fullyProtectedEntryIds.has(
            entry.id,
          )

        const hasTranslation =
          entry.translation
            .trim() !== ''

        /*
         * Protected أو Untranslated
         * ما تدخل Needs Review.
         */
        if (
          isProtected ||
          !hasTranslation
        ) {
          cache.set(
            entry.id,
            {
              source:
                entry.source,

              translation:
                entry.translation,

              tokenProfile,

              needsReview:
                false,
            },
          )

          continue
        }

        const cached =
          cache.get(
            entry.id,
          )

        /*
         * إذا كل البيانات المؤثرة
         * نفسها، نستخدم النتيجة
         * المحفوظة مباشرة.
         */
        if (
          cached &&
          cached.source ===
            entry.source &&
          cached.translation ===
            entry.translation &&
          cached.tokenProfile ===
            tokenProfile
        ) {
          if (
            cached.needsReview
          ) {
            needsReviewIds.add(
              entry.id,
            )
          }

          continue
        }

        const validation =
          validateProtectedTokens(
            entry.source,
            entry.translation,
            tokenProfile,
          )

        const needsReview =
          validation.hasErrors ||
          validation.hasWarnings

        cache.set(
          entry.id,
          {
            source:
              entry.source,

            translation:
              entry.translation,

            tokenProfile,

            needsReview,
          },
        )

        if (
          needsReview
        ) {
          needsReviewIds.add(
            entry.id,
          )
        }
      }

      /*
       * تنظيف Cache لأي Entries
       * لم تعد موجودة بعد فتح
       * ملف أو مشروع مختلف.
       */
      for (
        const id
        of cache.keys()
      ) {
        if (
          !activeIds.has(
            id,
          )
        ) {
          cache.delete(
            id,
          )
        }
      }

      return needsReviewIds
    },
    [
      entries,
      fullyProtectedEntryIds,
      tokenProfile,
    ],
  )
}