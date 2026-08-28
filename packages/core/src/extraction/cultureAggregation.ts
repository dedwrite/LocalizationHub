/*
 * Culture-aware localization aggregation.
 *
 * A multi-locale game may ship the same localization identity (namespace/key)
 * in multiple culture resources. Instead of producing one duplicate entry per
 * culture, this layer groups matching identities and produces ONE logical entry
 * per identity, with the native/source culture as `sourceText` and the other
 * cultures preserved as `localeVariants`.
 *
 * Uses LOCMETA (native culture) when available; otherwise falls back to the
 * first-discovered culture WITHOUT guessing (marked via target metadata).
 */

import type {
  ExtractedEntry,
  LocalizationTarget,
  ProtectedSegment,
} from './types'
import { alignInkbStories, isInkbEntry, type InkStoryMismatch } from './inkbAlignment'
import { extractProtectedTokens, type TokenProfileId } from '../tokens'
import { toProtectedSegments } from './engines/shared'

/*
 * Group extracted entries by a culture-independent identity. This is the
 * UNIVERSAL culture-aggregation interface:
 *
 *   - Any entry with an explicit `cultureIdentity` (Godot JSON databases, Godot
 *     `.inkb` stories) is grouped by that identity.
 *   - Unreal LOCRES falls back to `target::namespace::key`.
 *   - Entries without a multi-locale identity pass through unchanged.
 */
function identityOf(entry: ExtractedEntry): string | undefined {
  if (entry.cultureIdentity) return entry.cultureIdentity
  if (entry.origin.engine !== 'unreal') return undefined
  if (entry.origin.namespace == null || entry.key == null) return undefined
  const target = entry.rawMetadata?.localizationTarget ?? entry.origin.resourceName ?? ''
  return `unreal:${target}:${entry.origin.namespace}:${entry.key}`
}

/*
 * The localization "target" (surface) an entry belongs to. Used to build
 * `LocalizationTarget` metadata for the review's culture controls.
 *
 * For culture-identity'd entries, the target is the identity prefix
 * (e.g. `godot-db:fb`, `godot-inkb:1/1c/1c`); for Unreal it is the LOCRES
 * target.
 */
function targetOf(entry: ExtractedEntry): string {
  if (entry.cultureIdentity) {
    const first = entry.cultureIdentity.indexOf(':')
    const second = entry.cultureIdentity.indexOf(':', first + 1)
    return second === -1 ? entry.cultureIdentity : entry.cultureIdentity.slice(0, second)
  }
  return String(entry.rawMetadata?.localizationTarget ?? entry.origin.resourceName ?? 'unknown')
}

/*
 * Aggregate a scan's entries and produce localization-target metadata.
 *
 * - Godot `.inkb` story entries are routed through `alignInkbStories`, which
 *   performs line-level cross-locale alignment (matching lines merge, divergent
 *   lines stay isolated) — never a story-wide all-or-nothing guard.
 * - Godot JSON databases / Unreal LOCRES entries are grouped by their
 *   culture-independent identity; the native culture becomes the source and the
 *   rest become locale variants.
 * - All other entries pass through unchanged.
 */
export function aggregateCultures(
  entries: ExtractedEntry[],
): { entries: ExtractedEntry[]; targets: LocalizationTarget[]; mismatchStories: InkStoryMismatch[] } {
  const inkbEntries: ExtractedEntry[] = []
  const others: ExtractedEntry[] = []
  for (const entry of entries) {
    if (isInkbEntry(entry)) inkbEntries.push(entry)
    else others.push(entry)
  }

  const aligned = alignInkbStories(inkbEntries)
  const generic = aggregateGenericCultures(others)

  return {
    entries: [...generic.entries, ...aligned.entries],
    targets: [...generic.targets, ...aligned.targets],
    mismatchStories: aligned.mismatchStories,
  }
}

function aggregateGenericCultures(
  entries: ExtractedEntry[],
): { entries: ExtractedEntry[]; targets: LocalizationTarget[] } {
  const targetCultures = new Map<string, Set<string>>()
  const groups = new Map<string, ExtractedEntry[]>()

  for (const entry of entries) {
    if (entry.sourceLocale) {
      const target = targetOf(entry)
      const set = targetCultures.get(target) ?? new Set<string>()
      set.add(entry.sourceLocale)
      targetCultures.set(target, set)
    }

    const identity = identityOf(entry)
    if (identity) {
      const list = groups.get(identity) ?? []
      list.push(entry)
      groups.set(identity, list)
    }
  }

  const merged = new Map<string, ExtractedEntry>()
  const output: ExtractedEntry[] = []

  for (const entry of entries) {
    const identity = identityOf(entry)
    if (!identity) {
      output.push(entry)
      continue
    }
    if (merged.has(identity)) continue
    merged.set(identity, entry)

    const variants = groups.get(identity) ?? [entry]

    // Sort deterministically, but ALWAYS put the source/native entry first when
    // one is marked (`rawMetadata.isSourceLocale` — e.g. the unsuffixed base
    // Godot JSON database). Otherwise sort by locale for determinism.
    variants.sort((a, b) => {
      const aSource = a.rawMetadata?.isSourceLocale ? 0 : 1
      const bSource = b.rawMetadata?.isSourceLocale ? 0 : 1
      if (aSource !== bSource) return aSource - bSource
      return (a.sourceLocale ?? '').localeCompare(b.sourceLocale ?? '')
    })

    // The source (native, or first-discovered) becomes the source text.
    // `localeVariants` holds every OTHER culture (never the source culture).
    const first = variants[0]
    const localeVariants = variants
      .filter((v) => v !== first)
      .map((v) => ({ locale: v.sourceLocale ?? 'unknown', text: v.sourceText }))

    output.push({
      ...first,
      localeVariants: localeVariants.length > 0 ? localeVariants : undefined,
    })
  }

  const targets: LocalizationTarget[] = [...targetCultures.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, cultures]) => ({
      name,
      availableCultures: [...cultures].sort(),
    }))

  return { entries: output, targets }
}

/*
 * Apply native-culture info from LOCMETA-derived target metadata to the
 * aggregated result. When a target's native culture is known, the entry for that
 * culture is used as the source; other cultures become `localeVariants`.
 */
export function applyNativeCulture(
  result: { entries: ExtractedEntry[]; targets: LocalizationTarget[] },
  nativeByTarget: Map<string, string>,
): { entries: ExtractedEntry[]; targets: LocalizationTarget[] } {
  if (nativeByTarget.size === 0) return result

  const targets = result.targets.map((target) => ({
    ...target,
    nativeCulture: nativeByTarget.get(target.name),
  }))

  const entries = result.entries.map((entry) => {
    const target = targetOf(entry)
    const native = nativeByTarget.get(target)
    if (!native || !entry.localeVariants) return entry

    const nativeVariant = entry.localeVariants.find((v) => v.locale === native)
    if (!nativeVariant || nativeVariant.text === entry.sourceText) return entry

    // Swap: native culture becomes source. The old source culture becomes a
    // variant (preserving its text); the native culture is removed from the
    // variant list (it is now the source itself).
    const variants = [
      ...entry.localeVariants.filter((v) => v.locale !== native),
      { locale: entry.sourceLocale ?? 'unknown', text: entry.sourceText },
    ].sort((a, b) => a.locale.localeCompare(b.locale))

    return {
      ...entry,
      sourceText: nativeVariant.text,
      sourceLocale: native,
      localeVariants: variants.length > 0 ? variants : undefined,
    }
  })

  return { entries, targets }
}

/*
 * Infer each target's native/source culture from explicit base-content
 * evidence, without guessing alphabetically.
 *
 * Godot engines mark the unsuffixed base content with
 * `rawMetadata.isSourceLocale = true` (the file that is NOT a
 * `locales/<culture>/` overlay). That base content is the project's native
 * language. For every target whose native culture is not already known (e.g.
 * from Unreal LOCMETA), infer it from the source locale of those base entries.
 *
 * When no base evidence exists, the target's native culture stays unset — the
 * UI then shows an explicit "unknown/select" state instead of defaulting to the
 * first locale alphabetically.
 */
export function inferNativeCultures(
  entries: ExtractedEntry[],
  targets: LocalizationTarget[],
): LocalizationTarget[] {
  const sourceByTarget = new Map<string, Map<string, number>>()
  for (const entry of entries) {
    if (entry.rawMetadata?.isSourceLocale !== true) continue
    if (!entry.sourceLocale) continue
    const target = targetOf(entry)
    const counts = sourceByTarget.get(target) ?? new Map<string, number>()
    counts.set(entry.sourceLocale, (counts.get(entry.sourceLocale) ?? 0) + 1)
    sourceByTarget.set(target, counts)
  }

  return targets.map((target) => {
    if (target.nativeCulture) return target
    const counts = sourceByTarget.get(target.name)
    if (!counts || counts.size === 0) return target
    const native = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return { ...target, nativeCulture: native }
  })
}

/*
 * Override the source culture for every logical entry.
 *
 * For each entry with locale variants, the selected culture becomes the source
 * text (and source locale); the previous source culture becomes a variant and
 * the selected culture is removed from the variant list. Entries whose selected
 * culture is already the source (or which lack variants) are left unchanged.
 * This is what makes the Extraction Review source-language selector actually
 * change each entry's source text, not just a metadata label.
 */
export function overrideSourceCulture(
  entries: ExtractedEntry[],
  selectedCulture: string,
): ExtractedEntry[] {
  if (!selectedCulture) return entries

  return entries.map((entry) => {
    if (!entry.localeVariants) return entry
    if (entry.sourceLocale === selectedCulture) return entry

    const selectedVariant = entry.localeVariants.find((v) => v.locale === selectedCulture)
    if (!selectedVariant) return entry

    const variants = [
      ...entry.localeVariants.filter((v) => v.locale !== selectedCulture),
      { locale: entry.sourceLocale ?? 'unknown', text: entry.sourceText },
    ].sort((a, b) => a.locale.localeCompare(b.locale))

    return {
      ...entry,
      sourceText: selectedVariant.text,
      sourceLocale: selectedCulture,
      localeVariants: variants.length > 0 ? variants : undefined,
      // The protected segments correspond to the SOURCE text, so re-derive them
      // from the newly-selected locale's text (the entry's protection profile
      // is preserved). Falls back to the previous segments on any failure.
      protectedSegments: recomputeProtectedSegments(selectedVariant.text, entry),
    }
  })
}

function recomputeProtectedSegments(text: string, entry: ExtractedEntry): ProtectedSegment[] {
  try {
    const profileId = (entry.protectionProfile || 'generic') as TokenProfileId
    return toProtectedSegments(extractProtectedTokens(text, profileId))
  } catch {
    return entry.protectedSegments
  }
}

/*
 * Per-locale coverage across the LOGICAL entries.
 *
 * For each locale reports:
 *   - `source`: how many logical entries have that locale as their source text
 *   - `available`: how many entries have that locale available at all (as
 *     source OR a locale variant)
 *
 * This is the honest "which language is actually complete?" summary: a game
 * whose story is Japanese-only and databases are English-multi-locale will show
 * `ja` high on story source and `en` high on database source, rather than
 * silently blending them into one source language.
 */
export type LocaleCoverage = Record<string, { source: number; available: number }>

export function computeLocaleCoverage(entries: ExtractedEntry[]): LocaleCoverage {
  const coverage: LocaleCoverage = {}
  const bump = (locale: string | undefined, kind: 'source' | 'available') => {
    if (!locale) return
    const item = coverage[locale] ?? { source: 0, available: 0 }
    item[kind] += 1
    coverage[locale] = item
  }
  for (const entry of entries) {
    bump(entry.sourceLocale, 'source')
    bump(entry.sourceLocale, 'available')
    for (const variant of entry.localeVariants ?? []) {
      bump(variant.locale, 'available')
    }
  }
  return coverage
}

/*
 * Detect cross-locale structural divergence in `.inkb` stories.
 *
 * Returns the story paths whose locale copies carry DIFFERENT structural
 * fingerprints (translators merged/split/omitted lines). These stories must
 * NOT be merged by index — the caller keeps each locale separate and reports a
 * `locale-structure-mismatch` diagnostic.
 */
export function detectStructuralMismatches(
  entries: ExtractedEntry[],
): Array<{ storyPath: string; locales: string[] }> {
  const byStory = new Map<string, Map<string, string>>()
  for (const entry of entries) {
    const fp = entry.rawMetadata?.structuralFingerprint
    const scene = entry.context?.scene
    if (typeof fp !== 'string' || !fp || typeof scene !== 'string') continue
    let perLocale = byStory.get(scene)
    if (!perLocale) {
      perLocale = new Map()
      byStory.set(scene, perLocale)
    }
    perLocale.set(entry.sourceLocale ?? 'unknown', fp)
  }

  const mismatches: Array<{ storyPath: string; locales: string[] }> = []
  for (const [storyPath, perLocale] of byStory) {
    const uniqueFingerprints = new Set(perLocale.values())
    if (uniqueFingerprints.size > 1) {
      mismatches.push({ storyPath, locales: [...perLocale.keys()].sort() })
    }
  }
  return mismatches
}
