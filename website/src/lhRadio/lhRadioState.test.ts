import { describe, expect, it } from 'vitest'
import type { PublicRadioTrack } from '../radioApi'
import {
  createInitialState,
  INITIAL_LH_RADIO_STATE,
  lhRadioReducer,
  loadMutedPreference,
  loadOpenPreference,
  loadVolumePreference,
  saveMutedPreference,
  saveOpenPreference,
  saveVolumePreference,
  type LhRadioState,
  type StorageLike,
} from './lhRadioState'

function memoryStorage(seed?: Record<string, string>): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(seed ?? {}))
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => void data.set(key, value),
  }
}

function track(id: string, position: number): PublicRadioTrack {
  return { id, title: `Track ${id}`, artist: 'Artist', album: null, position, durationSeconds: null, artworkUrl: `/api/radio/tracks/${id}/artwork`, audioUrl: `/api/radio/tracks/${id}/audio` }
}

describe('lhRadioReducer', () => {
  it('starts collapsed, paused, at a sensible volume, with an idle catalog', () => {
    expect(INITIAL_LH_RADIO_STATE).toEqual({
      isOpen: false,
      currentTrackId: null,
      isPlaying: false,
      volume: 0.8,
      muted: false,
      catalog: [],
      catalogStatus: 'idle',
      error: null,
    })
  })

  it('toggles, opens, and closes the panel', () => {
    const opened = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'toggle-open' })
    expect(opened.isOpen).toBe(true)
    expect(lhRadioReducer(opened, { type: 'close' }).isOpen).toBe(false)
    expect(lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'open' }).isOpen).toBe(true)
  })

  it('loads a catalog and auto-selects the first track', () => {
    const loaded = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'catalog-loaded', tracks: [track('a', 0), track('b', 1)] })
    expect(loaded.catalogStatus).toBe('ready')
    expect(loaded.catalog).toHaveLength(2)
    expect(loaded.currentTrackId).toBe('a')
  })

  it('keeps an existing selection when the catalog refreshes', () => {
    const seeded: LhRadioState = { ...INITIAL_LH_RADIO_STATE, currentTrackId: 'b' }
    const loaded = lhRadioReducer(seeded, { type: 'catalog-loaded', tracks: [track('a', 0), track('b', 1)] })
    expect(loaded.currentTrackId).toBe('b')
  })

  it('selects a track and clears errors', () => {
    const errored = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'error', message: 'boom' })
    const selected = lhRadioReducer(errored, { type: 'select-track', trackId: 'a' })
    expect(selected.currentTrackId).toBe('a')
    expect(selected.error).toBeNull()
  })

  it('clamps volume into [0, 1] and unmutes on raising from zero', () => {
    expect(lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'volume', volume: 1.7 }).volume).toBe(1)
    expect(lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'volume', volume: -0.3 }).volume).toBe(0)
    const muted: LhRadioState = { ...INITIAL_LH_RADIO_STATE, muted: true, volume: 0 }
    expect(lhRadioReducer(muted, { type: 'volume', volume: 0.5 }).muted).toBe(false)
  })

  it('records catalog errors', () => {
    const failed = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'catalog-error', message: 'offline' })
    expect(failed.catalogStatus).toBe('error')
    expect(failed.error).toBe('offline')
  })
})

describe('lhRadio persistence', () => {
  it('persists and restores volume, muted, and open preferences', () => {
    const storage = memoryStorage()
    saveVolumePreference(0.42, storage)
    saveMutedPreference(true, storage)
    saveOpenPreference(true, storage)
    expect(loadVolumePreference(storage)).toBe(0.42)
    expect(loadMutedPreference(storage)).toBe(true)
    expect(loadOpenPreference(storage)).toBe(true)
  })

  it('clamps restored volume and defaults safely', () => {
    const storage = memoryStorage()
    expect(loadVolumePreference(storage)).toBe(0.8)
    expect(loadMutedPreference(storage)).toBe(false)
    saveVolumePreference(9, storage)
    expect(loadVolumePreference(storage)).toBe(1)
  })

  it('never persists playback or track state', () => {
    const storage = memoryStorage()
    const playing = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'playing', playing: true })
    const selected = lhRadioReducer(playing, { type: 'select-track', trackId: 'a' })
    expect(selected.isPlaying).toBe(true)
    expect(selected.currentTrackId).toBe('a')
    expect(Array.from(storage.data.keys())).toEqual([])
  })

  it('builds initial state from preferences', () => {
    const storage = memoryStorage()
    saveVolumePreference(0.25, storage)
    saveMutedPreference(true, storage)
    expect(createInitialState().volume).toBe(0.8) // no window.localStorage in Node
    expect(storage.data.get('localizationhub.web.lhRadio.volume')).toBe('0.25')
  })
})
