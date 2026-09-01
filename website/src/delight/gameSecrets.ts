import type { MessageKey } from '@localizationhub/i18n'

export const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
] as const

export const GAME_MEME_KEYS = [
  'delight.gameSecret.memePressF',
  'delight.gameSecret.memeWildString',
  'delight.gameSecret.memePlaceholder',
  'delight.gameSecret.memeCake',
] as const satisfies readonly MessageKey[]

export const OPEN_GAME_SECRET_EVENT = 'localizationhub:open-game-secret'

export function advanceKonamiProgress(progress: number, key: string): number {
  const normalized = key.length === 1 ? key.toLowerCase() : key
  if (normalized === KONAMI_SEQUENCE[progress]) return progress + 1
  return normalized === KONAMI_SEQUENCE[0] ? 1 : 0
}

export function openGameSecret() {
  window.dispatchEvent(new Event(OPEN_GAME_SECRET_EVENT))
}
