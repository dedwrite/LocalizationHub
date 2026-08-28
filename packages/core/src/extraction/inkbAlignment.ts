/*
 * Cross-locale structural alignment for Godot `.inkb` stories.
 *
 * The previous aggregation used a STORY-WIDE `structuralFingerprint`: if any
 * line anywhere in a story diverged between locales (a translator split/merged
 * a line), the ENTIRE story was refused a merge and every locale copy remained
 * a duplicate project row. On the real Until Then scan that left ~74 divergent
 * stories as ~48k duplicate entries (Dialogue = 67,081 raw instead of ~18k
 * logical).
 *
 * This module replaces the all-or-nothing guard with LINE-LEVEL alignment:
 *
 *   - Each locale's lines are reduced to a culture-independent structural
 *     token sequence (speaker key / thought / narration / continuation).
 *   - Each overlay is aligned against the base (source) story with a bounded
 *     Needleman–Wunsch global alignment on those tokens (never on translated
 *     text).
 *   - Matching lines merge into ONE logical entry (base source + locale
 *     variants). Lines that diverge are isolated as locale-only fragments —
 *     never mispaired.
 *
 * The alignment is partitioned PER STORY (bounded), and the fast path skips
 * alignment entirely when two token sequences are already identical (the
 * ~94%-identical common case).
 */

import type { ExtractedEntry, LocalizationTarget } from './types'
import { GODOT_NATIVE_FALLBACK_LOCALE } from './godotLocales'
import { structuralEntryId } from './structuredData'

const INKB_IDENTITY_PREFIX = 'godot-inkb:'

export function isInkbEntry(entry: ExtractedEntry): boolean {
  return typeof entry.cultureIdentity === 'string' && entry.cultureIdentity.startsWith(INKB_IDENTITY_PREFIX)
}

export type InkStoryMismatch = {
  storyPath: string
  locales: string[]
  /* Base (source) lines that had no matched overlay line in some locale. */
  unmatchedBase: number
  /* Overlay lines with no base counterpart (split/inserted), isolated. */
  unmatchedLocale: number
}

export type InkAlignmentResult = {
  entries: ExtractedEntry[]
  targets: LocalizationTarget[]
  mismatchStories: InkStoryMismatch[]
}

/*
 * Culture-independent structural token for a single line. Speaker keys are the
 * game's stable character aliases (Mark/Ryan/Louise) which do not change across
 * locales; translated text is never part of the token.
 */
function lineToken(entry: ExtractedEntry): string {
  const md = entry.rawMetadata ?? {}
  if (md.continuation === true) return 'cont'
  if (md.isThought === true) return 'thought'
  const key = md.charKey
  if (typeof key === 'string' && key.length > 0 && key !== 'narration' && key !== ':') {
    return `speaker:${key}`
  }
  return 'narration'
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
  return true
}

/*
 * Run-length encode a token sequence. Consecutive identical tokens (a speaker
 * key repeated on adjacent lines, or adjacent continuation lines) collapse into
 * one run with a count. This is what lets us distinguish a translator SPLIT
 * (locale run longer than base run) from an OMISSION (locale run shorter) — and
 * avoid arbitrarily pairing either fragment.
 */
type TokenRun = { token: string; count: number }

function encodeRuns(tokens: string[]): TokenRun[] {
  const runs: TokenRun[] = []
  for (const token of tokens) {
    const last = runs[runs.length - 1]
    if (last && last.token === token) last.count += 1
    else runs.push({ token, count: 1 })
  }
  return runs
}

/*
 * Needleman–Wunsch global alignment on RUN TOKENS (not individual lines).
 *
 * Returns, for each base run index, the matched locale run index (or -1), and
 * the list of unmatched locale run indices. Match +2 / mismatch -1 / gap -1.
 * Because run tokens are the distinct structural identities in order, this
 * aligns insertions/deletions of whole turns without shifting surrounding
 * lines.
 */
function alignRunTokens(
  base: string[],
  locale: string[],
): { baseToLocale: number[]; extraLocale: number[] } {
  const n = base.length
  const m = locale.length
  const MATCH = 2
  const MISMATCH = -1
  const GAP = -1

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i += 1) dp[i][0] = i * GAP
  for (let j = 1; j <= m; j += 1) dp[0][j] = j * GAP
  for (let i = 1; i <= n; i += 1) {
    const row = dp[i]
    const prev = dp[i - 1]
    const baseToken = base[i - 1]
    for (let j = 1; j <= m; j += 1) {
      const diag = prev[j - 1] + (baseToken === locale[j - 1] ? MATCH : MISMATCH)
      const up = prev[j] + GAP
      const left = row[j - 1] + GAP
      row[j] = diag >= up && diag >= left ? diag : (up >= left ? up : left)
    }
  }

  const baseToLocale: number[] = new Array(n).fill(-1)
  const matchedLocale = new Array(m).fill(false)
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    const score = base[i - 1] === locale[j - 1] ? MATCH : MISMATCH
    if (dp[i][j] === dp[i - 1][j - 1] + score) {
      baseToLocale[i - 1] = j - 1
      matchedLocale[j - 1] = true
      i -= 1
      j -= 1
    } else if (dp[i][j] === dp[i - 1][j] + GAP) {
      i -= 1
    } else {
      j -= 1
    }
  }

  const extraLocale: number[] = []
  for (let k = 0; k < m; k += 1) if (!matchedLocale[k]) extraLocale.push(k)
  return { baseToLocale, extraLocale }
}

/*
 * Align two line-level token sequences and produce matched pairs plus the
 * locale lines that must be isolated (never paired with a base line).
 *
 * Resolution within a matched run:
 *   - equal counts → zip 1:1
 *   - base < locale (SPLIT) → isolate ALL locale lines, leave base unmatched
 *   - base > locale (OMIT)  → zip min(count) in order, extra base unmatched
 */
function alignTokens(
  baseTokens: string[],
  localeTokens: string[],
): { pairs: Array<[number, number]>; extraLocale: number[] } {
  const baseRuns = encodeRuns(baseTokens)
  const localeRuns = encodeRuns(localeTokens)
  const runResult = alignRunTokens(
    baseRuns.map((r) => r.token),
    localeRuns.map((r) => r.token),
  )

  // Line-range start index for each run.
  const baseStarts: number[] = []
  let cursor = 0
  for (const r of baseRuns) {
    baseStarts.push(cursor)
    cursor += r.count
  }
  const localeStarts: number[] = []
  cursor = 0
  for (const r of localeRuns) {
    localeStarts.push(cursor)
    cursor += r.count
  }

  const pairs: Array<[number, number]> = []
  const extraLocale: number[] = []

  for (let bi = 0; bi < baseRuns.length; bi += 1) {
    const li = runResult.baseToLocale[bi]
    if (li < 0) continue // whole base run unmatched (an inserted overlay run)
    const bRun = baseRuns[bi]
    const lRun = localeRuns[li]
    const bStart = baseStarts[bi]
    const lStart = localeStarts[li]
    if (bRun.count === lRun.count) {
      for (let k = 0; k < bRun.count; k += 1) pairs.push([bStart + k, lStart + k])
    } else if (bRun.count < lRun.count) {
      // SPLIT: the translator turned one (or more) base line(s) into more
      // locale lines. Isolate ALL locale lines — never pair a fragment.
      for (let k = 0; k < lRun.count; k += 1) extraLocale.push(lStart + k)
    } else {
      // OMIT: the translator dropped lines. Pair what exists in order; the
      // extra base lines stay without a variant for this locale.
      for (let k = 0; k < lRun.count; k += 1) pairs.push([bStart + k, lStart + k])
    }
  }

  for (const li of runResult.extraLocale) {
    const lRun = localeRuns[li]
    const lStart = localeStarts[li]
    for (let k = 0; k < lRun.count; k += 1) extraLocale.push(lStart + k)
  }

  return { pairs, extraLocale }
}

/*
 * Choose the anchor (source) locale for a story: the unsuffixed base
 * (`isSourceLocale`), else the engine-native fallback if present, else the
 * locale with the most lines. Never a translation-text guess.
 */
function determineBaseLocale(byLocale: Map<string, ExtractedEntry[]>): string {
  for (const [locale, list] of byLocale) {
    if (list.some((e) => e.rawMetadata?.isSourceLocale === true)) return locale
  }
  if (byLocale.has(GODOT_NATIVE_FALLBACK_LOCALE)) return GODOT_NATIVE_FALLBACK_LOCALE
  let best = ''
  let bestCount = -1
  for (const [locale, list] of byLocale) {
    if (list.length > bestCount) {
      best = locale
      bestCount = list.length
    }
  }
  return best
}

export function alignInkbStories(entries: ExtractedEntry[]): InkAlignmentResult {
  const byStory = new Map<string, ExtractedEntry[]>()
  for (const entry of entries) {
    const story = entry.context?.scene ?? entry.origin.resourceName ?? ''
    const list = byStory.get(story) ?? []
    list.push(entry)
    byStory.set(story, list)
  }

  const output: ExtractedEntry[] = []
  const targets: LocalizationTarget[] = []
  const mismatchStories: InkStoryMismatch[] = []

  for (const [story, storyEntries] of byStory) {
    const byLocale = new Map<string, ExtractedEntry[]>()
    for (const entry of storyEntries) {
      const locale = entry.sourceLocale ?? 'unknown'
      const list = byLocale.get(locale) ?? []
      list.push(entry)
      byLocale.set(locale, list)
    }

    const baseLocale = determineBaseLocale(byLocale)
    const baseEntries = byLocale.get(baseLocale) ?? []
    const baseTokens = baseEntries.map(lineToken)
    const locales = [...byLocale.keys()].sort((a, b) => a.localeCompare(b))

    const variantsByBase = new Map<number, Array<{ locale: string; text: string }>>()
    let unmatchedLocale = 0

    for (const locale of locales) {
      if (locale === baseLocale) continue
      const localeEntries = byLocale.get(locale) ?? []
      const localeTokens = localeEntries.map(lineToken)

      let pairs: Array<[number, number]>
      let extraLocale: number[]
      if (arraysEqual(baseTokens, localeTokens)) {
        pairs = baseEntries.map((_, idx) => [idx, idx] as [number, number])
        extraLocale = []
      } else {
        const aligned = alignTokens(baseTokens, localeTokens)
        pairs = aligned.pairs
        extraLocale = aligned.extraLocale
      }

      for (const [baseIndex, localeIndex] of pairs) {
        const list = variantsByBase.get(baseIndex) ?? []
        list.push({ locale, text: localeEntries[localeIndex].sourceText })
        variantsByBase.set(baseIndex, list)
      }

      // Extra overlay lines (translator split/inserted) become isolated
      // locale-only entries — never mispaired with a base line.
      for (const k of extraLocale) {
        const e = localeEntries[k]
        output.push({
          ...e,
          id: structuralEntryId(['inkb', story, 'extra', locale, String(e.order)]),
          key: `${story}:extra:${locale}:${e.order}`,
          cultureIdentity: undefined,
          rawMetadata: { ...e.rawMetadata, alignmentExtra: true, alignmentLocale: locale },
        })
        unmatchedLocale += 1
      }
    }

    for (let i = 0; i < baseEntries.length; i += 1) {
      const base = baseEntries[i]
      const variants = (variantsByBase.get(i) ?? []).sort((a, b) => a.locale.localeCompare(b.locale))
      output.push({
        ...base,
        cultureIdentity: `godot-inkb:${story}:${i}`,
        localeVariants: variants.length > 0 ? variants : undefined,
      })
    }

    targets.push({
      name: `godot-inkb:${story}`,
      availableCultures: locales,
    })

    // Count base lines missing a counterpart in at least one overlay locale
    // (an omitted or split line), for the mismatch diagnostic.
    const overlayLocales = locales.filter((locale) => locale !== baseLocale)
    let unmatchedBase = 0
    for (let i = 0; i < baseEntries.length; i += 1) {
      const variants = variantsByBase.get(i) ?? []
      for (const locale of overlayLocales) {
        if (!variants.some((v) => v.locale === locale)) unmatchedBase += 1
      }
    }

    if (unmatchedBase > 0 || unmatchedLocale > 0) {
      mismatchStories.push({
        storyPath: story,
        locales,
        unmatchedBase,
        unmatchedLocale,
      })
    }
  }

  return { entries: output, targets, mismatchStories }
}
