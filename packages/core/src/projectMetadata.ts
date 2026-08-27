import type { ExtractionEngineInfo } from './extraction/types'

export type ProjectTag = { id: string; label: string }

export type EntryComment = {
  id: string
  entryId: string
  body: string
  authorId?: string
  authorName: string
  createdAt: string
  resolved: boolean
}

export type GlossaryEntry = {
  sourceTerm: string
  preferredTranslation: string
  forbiddenTranslations: string[]
  caseSensitive: boolean
  notes?: string
}

export type TranslationMemoryEntry = {
  source: string
  translation: string
  approvedAt?: string
}

export type ProjectMetadata = {
  tags: ProjectTag[]
  entryTags: Record<string, string[]>
  assignments: Record<string, string>
  comments: EntryComment[]
  glossary: GlossaryEntry[]
  translationMemory: TranslationMemoryEntry[]
  extraction?: ExtractionEngineInfo
}

export const emptyProjectMetadata = (): ProjectMetadata => ({
  tags: [], entryTags: {}, assignments: {}, comments: [], glossary: [], translationMemory: [],
})

export function normalizeTagLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

export function addProjectTag(metadata: ProjectMetadata, label: string): ProjectMetadata {
  const normalized = normalizeTagLabel(label)
  if (!normalized || metadata.tags.some((tag) => tag.label.toLocaleLowerCase() === normalized.toLocaleLowerCase())) return metadata
  return { ...metadata, tags: [...metadata.tags, { id: normalized.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-'), label: normalized }] }
}

export function toggleEntryTag(metadata: ProjectMetadata, entryId: string, tagId: string): ProjectMetadata {
  const current = metadata.entryTags[entryId] ?? []
  const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
  return { ...metadata, entryTags: { ...metadata.entryTags, [entryId]: next } }
}

export function updateGlossaryEntry(metadata: ProjectMetadata, index: number, entry: GlossaryEntry): ProjectMetadata {
  if (index < 0 || index >= metadata.glossary.length) return metadata
  const normalized: GlossaryEntry = {
    ...entry,
    sourceTerm: entry.sourceTerm.trim(),
    preferredTranslation: entry.preferredTranslation.trim(),
    forbiddenTranslations: [...new Set(entry.forbiddenTranslations.map((value) => value.trim()).filter(Boolean))],
    notes: entry.notes?.trim() || undefined,
  }
  const glossary = metadata.glossary.slice()
  glossary[index] = normalized
  return { ...metadata, glossary }
}

export function glossaryIssues(source: string, translation: string, glossary: GlossaryEntry[]) {
  return glossary.flatMap((term) => {
    const flags = term.caseSensitive ? 'g' : 'gi'
    const sourceMatch = new RegExp(`(?:^|\\W)${escapeRegExp(term.sourceTerm)}(?=$|\\W)`, flags).test(source)
    if (!sourceMatch) return []
    const forbidden = term.forbiddenTranslations.some((value) => new RegExp(`(?:^|\\W)${escapeRegExp(value)}(?=$|\\W)`, flags).test(translation))
    const preferredMissing = Boolean(term.preferredTranslation) && !new RegExp(`(?:^|\\W)${escapeRegExp(term.preferredTranslation)}(?=$|\\W)`, flags).test(translation)
    return forbidden || preferredMissing ? [{ term, forbidden, preferredMissing }] : []
  })
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

export function similarity(left: string, right: string): number {
  const a = left.trim().toLocaleLowerCase(); const b = right.trim().toLocaleLowerCase()
  if (!a || !b || Math.min(a.length, b.length) < 4) return 0
  if (a === b) return 1
  const distance = levenshtein(a, b)
  return 1 - distance / Math.max(a.length, b.length)
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) { let diagonal = row[0]; row[0] = i; for (let j = 1; j <= b.length; j += 1) { const above = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)); diagonal = above } }
  return row[b.length]
}

export function findTranslationMemory(source: string, memory: TranslationMemoryEntry[], threshold = 0.55) {
  const unique = new Map<string, TranslationMemoryEntry>()
  for (const item of memory) { if (item.source.trim() && item.translation.trim() && !unique.has(`${item.source}\u0000${item.translation}`)) unique.set(`${item.source}\u0000${item.translation}`, item) }
  return [...unique.values()].map((item) => ({ ...item, score: similarity(source, item.source) })).filter((item) => item.score >= threshold).sort((a, b) => b.score - a.score || a.source.localeCompare(b.source))
}
