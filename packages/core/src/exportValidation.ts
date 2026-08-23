import type {
  ParsedLocalizationEntry,
} from '@localizationhub/core'

import {
  validateProtectedTokens,
  type TokenProfileId,
} from '@localizationhub/core'

export type ExportValidationSummary = {
  errorEntryIds:
    string[]

  warningEntryIds:
    string[]

  errorCount:
    number

  warningCount:
    number
}

/*
 * يفحص جودة الترجمات قبل Export.
 *
 * القواعد:
 *
 * - Fully Protected:
 *   نتجاهلها هنا لأن App عنده
 *   guard مستقل لها.
 *
 * - Untranslated:
 *   ما تعتبر Token Error.
 *
 * - Token Errors:
 *   تمنع التصدير.
 *
 * - Token Warnings:
 *   ما تمنع التصدير،
 *   لكن نحذر المستخدم منها.
 */
export function analyzeExportValidation(
  entries:
    ParsedLocalizationEntry[],

  fullyProtectedEntryIds:
    Set<string>,

  tokenProfile:
    TokenProfileId,
): ExportValidationSummary {
  const errorEntryIds:
    string[] =
      []

  const warningEntryIds:
    string[] =
      []

  for (
    const entry
    of entries
  ) {
    /*
     * Fully Protected لها
     * validation منفصل في App.
     */
    if (
      fullyProtectedEntryIds.has(
        entry.id,
      )
    ) {
      continue
    }

    /*
     * Entry غير مترجمة
     * ما نعتبرها مشكلة Tokens.
     */
    if (
      entry.translation
        .trim() === ''
    ) {
      continue
    }

    const validation =
      validateProtectedTokens(
        entry.source,
        entry.translation,
        tokenProfile,
      )

    /*
     * Error يأخذ الأولوية.
     *
     * إذا Entry فيها Error + Warning
     * نحسبها Error فقط حتى ما
     * يتكرر عدها مرتين.
     */
    if (
      validation.hasErrors
    ) {
      errorEntryIds.push(
        entry.id,
      )

      continue
    }

    if (
      validation.hasWarnings
    ) {
      warningEntryIds.push(
        entry.id,
      )
    }
  }

  return {
    errorEntryIds,

    warningEntryIds,

    errorCount:
      errorEntryIds.length,

    warningCount:
      warningEntryIds.length,
  }
}