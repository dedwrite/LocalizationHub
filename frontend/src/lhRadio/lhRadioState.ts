import type { PublicRadioTrack } from '../radioApi'

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface LhRadioState {
  isOpen: boolean
  currentTrackId: string | null
  isPlaying: boolean
  volume: number
  muted: boolean
  catalog: PublicRadioTrack[]
  catalogStatus: CatalogStatus
  error: string | null
}

export const INITIAL_LH_RADIO_STATE: LhRadioState = {
  isOpen: false,
  currentTrackId: null,
  isPlaying: false,
  volume: 0.8,
  muted: false,
  catalog: [],
  catalogStatus: 'idle',
  error: null,
}

export type LhRadioAction =
  | { type: 'toggle-open' }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'catalog-loading' }
  | { type: 'catalog-loaded'; tracks: PublicRadioTrack[] }
  | { type: 'catalog-error'; message: string }
  | { type: 'select-track'; trackId: string }
  | { type: 'playing'; playing: boolean }
  | { type: 'volume'; volume: number }
  | { type: 'muted'; muted: boolean }
  | { type: 'error'; message: string | null }

export function lhRadioReducer(state: LhRadioState, action: LhRadioAction): LhRadioState {
  switch (action.type) {
    case 'toggle-open':
      return { ...state, isOpen: !state.isOpen }
    case 'open':
      return { ...state, isOpen: true }
    case 'close':
      return { ...state, isOpen: false }
    case 'catalog-loading':
      return { ...state, catalogStatus: 'loading' }
    case 'catalog-loaded':
      return {
        ...state,
        catalog: action.tracks,
        catalogStatus: 'ready',
        currentTrackId: state.currentTrackId ?? action.tracks[0]?.id ?? null,
      }
    case 'catalog-error':
      return { ...state, catalogStatus: 'error', error: action.message }
    case 'select-track':
      return { ...state, currentTrackId: action.trackId, error: null }
    case 'playing':
      return { ...state, isPlaying: action.playing }
    case 'volume':
      return { ...state, volume: clamp01(action.volume), muted: action.volume > 0 ? false : state.muted }
    case 'muted':
      return { ...state, muted: action.muted }
    case 'error':
      return { ...state, error: action.message }
    default:
      return state
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

const OPEN_PREFERENCE_KEY = 'localizationhub.desktop.lhRadio.open'
const VOLUME_PREFERENCE_KEY = 'localizationhub.desktop.lhRadio.volume'
const MUTED_PREFERENCE_KEY = 'localizationhub.desktop.lhRadio.muted'

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

export function loadVolumePreference(storage?: StorageLike): number {
  try {
    const target = storage ?? defaultStorage()
    if (!target) return INITIAL_LH_RADIO_STATE.volume
    const raw = target.getItem(VOLUME_PREFERENCE_KEY)
    if (raw == null) return INITIAL_LH_RADIO_STATE.volume
    const value = Number(raw)
    return Number.isFinite(value) ? clamp01(value) : INITIAL_LH_RADIO_STATE.volume
  } catch {
    return INITIAL_LH_RADIO_STATE.volume
  }
}

export function loadMutedPreference(storage?: StorageLike): boolean {
  try {
    const target = storage ?? defaultStorage()
    if (!target) return false
    const raw = target.getItem(MUTED_PREFERENCE_KEY)
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
    // Ignore.
  }
}

export function saveVolumePreference(volume: number, storage?: StorageLike): void {
  try {
    const target = storage ?? defaultStorage()
    target?.setItem(VOLUME_PREFERENCE_KEY, String(clamp01(volume)))
  } catch {
    // Ignore.
  }
}

export function saveMutedPreference(muted: boolean, storage?: StorageLike): void {
  try {
    const target = storage ?? defaultStorage()
    target?.setItem(MUTED_PREFERENCE_KEY, muted ? '1' : '0')
  } catch {
    // Ignore.
  }
}

export function createInitialState(): LhRadioState {
  return {
    ...INITIAL_LH_RADIO_STATE,
    isOpen: loadOpenPreference(),
    volume: loadVolumePreference(),
    muted: loadMutedPreference(),
  }
}
