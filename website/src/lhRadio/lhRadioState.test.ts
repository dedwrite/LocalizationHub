import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  INITIAL_LH_RADIO_STATE,
  lhRadioReducer,
  loadOpenPreference,
  saveOpenPreference,
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

describe('lhRadioReducer', () => {
  it('starts collapsed with no playback and an idle embed', () => {
    expect(INITIAL_LH_RADIO_STATE).toEqual({
      isOpen: false,
      hasUserStartedPlayback: false,
      isPlaying: false,
      embedStatus: 'idle',
      error: null,
    })
  })

  it('toggles, opens, and closes the panel', () => {
    const opened = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'toggle' })
    expect(opened.isOpen).toBe(true)
    expect(lhRadioReducer(opened, { type: 'close' }).isOpen).toBe(false)
    expect(lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'open' }).isOpen).toBe(true)
  })

  it('marks playback as started only from a user gesture or a real playing event', () => {
    expect(INITIAL_LH_RADIO_STATE.hasUserStartedPlayback).toBe(false)
    const marked = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'mark-started' })
    expect(marked.hasUserStartedPlayback).toBe(true)
    const viaPlayback = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'playing-changed', playing: true })
    expect(viaPlayback.hasUserStartedPlayback).toBe(true)
  })

  it('synchronizes playing state without losing the started flag', () => {
    const started: LhRadioState = { ...INITIAL_LH_RADIO_STATE, hasUserStartedPlayback: true }
    const playing = lhRadioReducer(started, { type: 'playing-changed', playing: true })
    expect(playing.isPlaying).toBe(true)
    expect(playing.hasUserStartedPlayback).toBe(true)
    const paused = lhRadioReducer(playing, { type: 'playing-changed', playing: false })
    expect(paused.isPlaying).toBe(false)
    expect(paused.hasUserStartedPlayback).toBe(true)
  })

  it('records embed status and error', () => {
    const failed = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'embed-status', status: 'error', error: 'Spotify is unavailable.' })
    expect(failed.embedStatus).toBe('error')
    expect(failed.error).toBe('Spotify is unavailable.')
    expect(lhRadioReducer(failed, { type: 'embed-status', status: 'ready' }).embedStatus).toBe('ready')
  })
})

describe('lhRadio persistence', () => {
  it('persists and restores only the open/collapsed preference', () => {
    const storage = memoryStorage()
    expect(loadOpenPreference(storage)).toBe(false)
    saveOpenPreference(true, storage)
    expect(loadOpenPreference(storage)).toBe(true)
    saveOpenPreference(false, storage)
    expect(loadOpenPreference(storage)).toBe(false)
  })

  it('initial state honours a saved open preference', () => {
    const storage = memoryStorage()
    saveOpenPreference(true, storage)
    const initial = createInitialState()
    expect(initial.isOpen).toBe(false) // no window.localStorage in Node; default collapsed
    expect(storage.data.get('localizationhub.web.lhRadio.open')).toBe('1')
  })

  it('never persists playback state', () => {
    const storage = memoryStorage()
    const playing = lhRadioReducer(INITIAL_LH_RADIO_STATE, { type: 'playing-changed', playing: true })
    expect(playing.isPlaying).toBe(true)
    // Only the open preference key is ever written.
    const keys = Array.from(storage.data.keys())
    expect(keys).toEqual([])
  })
})
