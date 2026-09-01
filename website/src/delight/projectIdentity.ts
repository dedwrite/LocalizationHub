export const PROJECT_PALETTES = [
  { accent: '#a78bfa', soft: '#2b2142', ink: '#eee8ff' },
  { accent: '#7dd3fc', soft: '#172b3a', ink: '#e4f7ff' },
  { accent: '#6ee7b7', soft: '#17342d', ink: '#e4fff6' },
  { accent: '#f0abfc', soft: '#39203d', ink: '#fff0ff' },
  { accent: '#fbbf7a', soft: '#3b291b', ink: '#fff4e5' },
  { accent: '#93c5fd', soft: '#1d2d46', ink: '#eaf3ff' },
] as const

export type ProjectIdentity = (typeof PROJECT_PALETTES)[number] & { initials: string; index: number }

export function stableProjectHash(seed: string): number {
  let hash = 2166136261
  for (const character of seed.trim().toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function projectInitials(label: string): string {
  const parts = label.trim().split(/[\s._-]+/u).filter(Boolean)
  if (parts.length === 0) return 'LH'
  const first = Array.from(parts[0])[0] ?? 'L'
  const last = parts.length > 1 ? Array.from(parts.at(-1) ?? '')[0] ?? '' : Array.from(parts[0])[1] ?? ''
  return `${first}${last}`.toLocaleUpperCase()
}

export function projectIdentity(seed: string, label = seed): ProjectIdentity {
  const index = stableProjectHash(seed || label) % PROJECT_PALETTES.length
  return { ...PROJECT_PALETTES[index], initials: projectInitials(label), index }
}
