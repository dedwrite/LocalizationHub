import type { QuietCommand } from './quietCommands'

type EntryLike = {
  id?: string
  key?: string
  source?: string
  translation?: string
  context?: string
  notes?: string
}

export function entryJumpCommands(
  entries: EntryLike[],
  query: string,
  onJump: (index: number) => void,
  limit = 8,
): QuietCommand[] {
  const parts = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean)
  if (parts.length === 0) return []
  const matches: QuietCommand[] = []
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]
    const key = entry.key || entry.id || `#${index + 1}`
    const haystack = `${entry.id ?? ''} ${entry.key ?? ''} ${entry.source ?? ''} ${entry.translation ?? ''} ${entry.context ?? ''} ${entry.notes ?? ''}`.toLocaleLowerCase()
    if (!parts.every((part) => haystack.includes(part))) continue
    const preview = (entry.source || entry.translation || key).replace(/\s+/gu, ' ').trim()
    matches.push({
      id: `entry.jump.${entry.id ?? index}`,
      label: `Go to ${key}`,
      hint: preview.slice(0, 48),
      keywords: haystack,
      group: 'entry',
      run: () => onJump(index),
    })
    if (matches.length >= limit) break
  }
  return matches
}
