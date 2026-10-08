/** Stable, deterministic visual identity for a project name. No network, no images. */

export type ProjectIdentity = {
  accent: string
  accentSoft: string
  glyph: string
  tone: number
}

const PALETTE = [
  { accent: '#bafa61', soft: '#66803d33' },
  { accent: '#7eb8c9', soft: '#3d6e7a33' },
  { accent: '#c9a07e', soft: '#7a5a3d33' },
  { accent: '#8fc49a', soft: '#3d7a4d33' },
  { accent: '#d09bb8', soft: '#7a3d5f33' },
  { accent: '#a6b6b0', soft: '#455b5233' },
  { accent: '#c9c07e', soft: '#7a733d33' },
  { accent: '#7ec9b0', soft: '#3d7a6833' },
] as const

function hashName(name: string): number {
  let hash = 2166136261
  const normalized = name.trim().toLocaleLowerCase()
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function firstGlyph(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '·'
  const match = trimmed.match(/[\p{L}\p{N}]/u)
  const char = match?.[0] ?? trimmed[0]
  return char.toLocaleUpperCase()
}

export function projectIdentity(name: string): ProjectIdentity {
  const tone = hashName(name || 'untitled') % PALETTE.length
  const swatch = PALETTE[tone]
  return {
    accent: swatch.accent,
    accentSoft: swatch.soft,
    glyph: firstGlyph(name || 'untitled'),
    tone,
  }
}
