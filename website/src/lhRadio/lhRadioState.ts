// Pure state model for the global LH Radio shell.
//
// This module is intentionally free of React and Spotify dependencies so the
// reducer and persistence helpers can be unit-tested without a DOM or a live
// Spotify connection.

export type EmbedStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface LhRadioState {
  isOpen: boolean
  hasUserStartedPlayback: boolean
  isPlaying: boolean
  embedStatus: EmbedStatus
  error: string | null
}

export const INITIAL_LH_RADIO_STATE: LhRadioState = {
  isOpen: false,
  hasUserStartedPlayback: false,
  isPlaying: false,
  embedStatus: 'idle',
  error: null,
}

export type LhRadioAction =
  | { type: 'toggle' }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'mark-started' }
  | { type: 'playing-changed'; playing: boolean }
  | { type: 'embed-status'; status: EmbedStatus; error?: string | null }

export function lhRadioReducer(state: LhRadioState, action: LhRadioAction): LhRadioState {
  switch (action.type) {
    case 'toggle':
      return { ...state, isOpen: !state.isOpen }
    case 'open':
      return { ...state, isOpen: true }
    case 'close':
      return { ...state, isOpen: false }
    case 'mark-started':
      return state.hasUserStartedPlayback ? state : { ...state, hasUserStartedPlayback: true }
    case 'playing-changed':
      return {
        ...state,
        isPlaying: action.playing,
        hasUserStartedPlayback: state.hasUserStartedPlayback || action.playing,
      }
    case 'embed-status':
      return { ...state, embedStatus: action.status, error: action.error ?? null }
    default:
      return state
  }
}

// Collapsed/expanded is the only value persisted locally, per the product
// constraint that only harmless UI preferences are stored. Playback state and
// any Spotify account data are never persisted.
const OPEN_PREFERENCE_KEY = 'localizationhub.web.lhRadio.open'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function loadOpenPreference(storage?: StorageLike): boolean {
  try {
    const target = storage ?? defaultStorage()
    if (!target) return false
    const raw = target.getItem(OPEN_PREFERENCE_KEY)
    return raw === '1' || raw === 'true'
  } catch {
    return false
  }
}

export function saveOpenPreference(isOpen: boolean, storage?: StorageLike): void {
  try {
    const target = storage ?? defaultStorage()
    target?.setItem(OPEN_PREFERENCE_KEY, isOpen ? '1' : '0')
  } catch {
    // Storage may be unavailable (private mode / disabled). Ignore.
  }
}

export function createInitialState(): LhRadioState {
  return { ...INITIAL_LH_RADIO_STATE, isOpen: loadOpenPreference() }
}
