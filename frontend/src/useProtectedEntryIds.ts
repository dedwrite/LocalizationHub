import {
  useMemo,
  useRef,
} from 'react'

import type {
  ParsedLocalizationEntry,
} from './parsers'

import type {
  TokenProfileId,
} from './tokens'

import {
  isFullyProtectedText,
} from './tokens/protection'

type ProtectionCacheEntry = {
  source: string

  tokenProfile:
    TokenProfileId

  isProtected:
    boolean
}

/*
 * يحسب الـEntries المحمية بالكامل
 * مع Cache داخلي.
 *
 * المشكلة القديمة:
 *
 * كل حرف في الترجمة يغيّر entries،
 * وبالتالي App كان يعيد:
 *
 * isFullyProtectedText(...)
 *
 * على آلاف الـEntries.
 *
 * مع هذا الـhook:
 *
 * - إذا source نفسها
 * - وtokenProfile نفسه
 *
 * نستخدم النتيجة المحفوظة مباشرة.
 */
export function useProtectedEntryIds(
  entries:
    ParsedLocalizationEntry[],

  tokenProfile:
    TokenProfileId,
): Set<string> {
  const cacheRef =
    useRef(
      new Map<
        string,
        ProtectionCacheEntry
      >(),
    )

  return useMemo(
    () => {
      const protectedIds =
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

        const cached =
          cache.get(
            entry.id,
          )

        /*
         * لو الـSource والـProfile
         * ما تغيروا، ما فيه داعي
         * نعيد Token extraction.
         */
        if (
          cached &&
          cached.source ===
            entry.source &&
          cached.tokenProfile ===
            tokenProfile
        ) {
          if (
            cached.isProtected
          ) {
            protectedIds.add(
              entry.id,
            )
          }

          continue
        }

        const isProtected =
          isFullyProtectedText(
            entry.source,
            tokenProfile,
          )

        cache.set(
          entry.id,
          {
            source:
              entry.source,

            tokenProfile,

            isProtected,
          },
        )

        if (
          isProtected
        ) {
          protectedIds.add(
            entry.id,
          )
        }
      }

      /*
       * تنظيف أي Entries قديمة
       * بعد فتح ملف / مشروع جديد.
       *
       * عشان الـcache ما يكبر
       * إلى الأبد.
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

      return protectedIds
    },
    [
      entries,
      tokenProfile,
    ],
  )
}