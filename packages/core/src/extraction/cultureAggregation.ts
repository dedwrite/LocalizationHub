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
} from './types'

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
 * - Unreal LOCRES entries are grouped by target/namespace/key; the native
 *   culture becomes the source and the rest become locale variants.
 * - All other entries pass through unchanged.
 */
export function aggregateCultures(
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
    }
  })
}

export { identityOf, targetOf }
