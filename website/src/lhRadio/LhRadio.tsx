import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { fetchRadioCatalog, type PublicRadioTrack } from '../radioApi'
import {
  createInitialState,
  lhRadioReducer,
  saveMutedPreference,
  saveOpenPreference,
  saveVolumePreference,
} from './lhRadioState'
import './LhRadio.css'
import { playbackProgressPercent } from './lhRadioProgress'

/*
 * The single global native LH Radio player. Mounted once at the app shell level
 * so it survives SPA route transitions. Playback uses a structural (hidden)
 * HTMLAudioElement; the UI is entirely LocalizationHub-native. The catalog is
 * fetched from the public radio API and the playlist order comes from the
 * Admin-configured `position`.
 */
export default function LhRadio() {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(lhRadioReducer, undefined, createInitialState)
  const [taglineIndex, setTaglineIndex] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const seekRef = useRef<HTMLInputElement>(null)
  const currentTimeRef = useRef<HTMLSpanElement>(null)
  const durationRef = useRef<HTMLSpanElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)
  const seekingRef = useRef(false)

  const isAppSurface = typeof window !== 'undefined' && window.location.pathname.startsWith('/app')

  // Load the public catalog once on mount.
  useEffect(() => {
    let alive = true
    dispatch({ type: 'catalog-loading' })
    fetchRadioCatalog()
      .then((tracks) => {
        if (alive) dispatch({ type: 'catalog-loaded', tracks })
      })
      .catch((error) => {
        if (alive) dispatch({ type: 'catalog-error', message: error instanceof Error ? error.message : 'Radio unavailable.' })
      })
    return () => {
      alive = false
    }
  }, [])

  const currentTrack: PublicRadioTrack | null = state.catalog.find((t) => t.id === state.currentTrackId) ?? null
  const currentIndex = currentTrack ? state.catalog.findIndex((t) => t.id === currentTrack.id) : -1

  function syncSeekDom() {
    const audio = audioRef.current
    const seek = seekRef.current
    if (audio && seek && !seekingRef.current) {
      if (Number.isFinite(audio.duration) && audio.duration > 0) seek.max = String(audio.duration)
      seek.value = String(audio.currentTime || 0)
    }
    if (currentTimeRef.current) currentTimeRef.current.textContent = formatTime(audio?.currentTime ?? 0)
    if (durationRef.current) durationRef.current.textContent = formatTime(audio?.duration ?? 0)
    if (progressRef.current) {
      const percent = audio ? playbackProgressPercent(audio.currentTime, audio.duration) : 0
      progressRef.current.style.setProperty('--lh-radio-progress', `${percent}%`)
    }
  }

  useEffect(() => {
    if (!state.isOpen) {
      setTaglineIndex(0)
      return
    }
    const timer = window.setInterval(() => {
      setTaglineIndex((current) => (current + 1) % 4)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [state.isOpen])

  function playTrack(trackId: string) {
    const audio = audioRef.current
    const track = state.catalog.find((t) => t.id === trackId)
    if (!audio || !track) return
    dispatch({ type: 'select-track', trackId })
    dispatch({ type: 'error', message: null })
    const url = new URL(track.audioUrl, window.location.origin).href
    if (audio.src !== url) audio.src = track.audioUrl
    audio.play().catch(() => dispatch({ type: 'error', message: 'Could not play this track.' }))
  }

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (state.isPlaying) {
      audio.pause()
      return
    }
    if (currentTrack) {
      audio.play().catch(() => dispatch({ type: 'error', message: 'Could not play this track.' }))
    } else if (state.catalog.length > 0) {
      playTrack(state.catalog[0].id)
    }
  }

  function next() {
    if (state.catalog.length === 0) return
    if (currentIndex < 0) {
      playTrack(state.catalog[0].id)
      return
    }
    playTrack(state.catalog[(currentIndex + 1) % state.catalog.length].id)
  }

  function previous() {
    if (state.catalog.length === 0) return
    if (currentIndex <= 0) {
      playTrack(state.catalog[state.catalog.length - 1].id)
      return
    }
    playTrack(state.catalog[currentIndex - 1].id)
  }

  // Keep the structural audio element in sync with selection and preferences.
  useEffect(() => {
    const audio = audioRef.current
    progressRef.current?.style.setProperty('--lh-radio-progress', '0%')
    if (!audio || !currentTrack) return
    const url = new URL(currentTrack.audioUrl, window.location.origin).href
    if (audio.src !== url) {
      audio.src = currentTrack.audioUrl
      audio.load()
    }
  }, [currentTrack])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = state.volume
      audio.muted = state.muted
    }
  }, [state.volume, state.muted])

  useEffect(() => {
    saveOpenPreference(state.isOpen)
  }, [state.isOpen])

  useEffect(() => {
    saveVolumePreference(state.volume)
  }, [state.volume])

  useEffect(() => {
    saveMutedPreference(state.muted)
  }, [state.muted])

  // Audio element event wiring.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    let raf = 0
    const onTime = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        syncSeekDom()
      })
    }
    const onPlay = () => dispatch({ type: 'playing', playing: true })
    const onPause = () => dispatch({ type: 'playing', playing: false })
    const onEnded = () => next()
    const onError = () => dispatch({ type: 'error', message: 'Could not play this track.' })
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onTime)
    audio.addEventListener('durationchange', onTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      cancelAnimationFrame(raf)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onTime)
      audio.removeEventListener('durationchange', onTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
    // `next` closes over currentIndex/catalog; rewire when those change.
  }, [state.currentTrackId, state.catalog])

  // Empty / failed catalog: hide the player cleanly rather than look broken.
  if (state.catalogStatus === 'error' || (state.catalogStatus === 'ready' && state.catalog.length === 0)) {
    return <audio ref={audioRef} className="lh-radio-audio" preload="metadata" hidden />
  }

  const discArt = currentTrack?.artworkUrl ?? null
  const nextUp = state.catalog.slice(0, 50)

  return (
    <div
      className={`lh-radio ${state.isOpen ? 'is-open' : 'is-collapsed'} ${state.isPlaying ? 'is-playing' : ''}`}
      data-surface={isAppSurface ? 'app' : 'public'}
    >
      <audio ref={audioRef} className="lh-radio-audio" preload="metadata" hidden />

      {/* ---- Expanded panel ---- */}
      <section className="lh-radio-panel" role="region" aria-label="LH Radio player" aria-hidden={!state.isOpen}>
        <header className="lh-radio-panel-head">
          <div className="lh-radio-panel-title">
            <span className="lh-radio-kicker">LH RADIO</span>
            <span key={taglineIndex} className="lh-radio-sub lh-radio-tagline" data-i18n-content aria-hidden="true">{t((['radio.player.tagline.one', 'radio.player.tagline.two', 'radio.player.tagline.three', 'radio.player.tagline.four'] as const)[taglineIndex])}</span>
          </div>
          <button type="button" className="lh-radio-icon-btn" onClick={() => dispatch({ type: 'close' })} aria-label="Collapse LH Radio">
            ×
          </button>
        </header>

        <div className="lh-radio-now">
          <div className="lh-radio-disc" aria-hidden="true">
            {discArt ? (
              <img className="lh-radio-disc-art" src={discArt} alt="" />
            ) : (
              <span className="lh-radio-disc-fallback">♪</span>
            )}
            <span className="lh-radio-disc-hub" />
          </div>
          <div className="lh-radio-now-meta">
            <span className="lh-radio-now-title" data-i18n-content={currentTrack ? true : undefined}>{currentTrack?.title ?? 'LH Radio'}</span>
            <span className="lh-radio-now-artist" data-i18n-content={currentTrack ? true : undefined}>{currentTrack?.artist ?? 'Select a track'}</span>
            {currentTrack?.album && <span className="lh-radio-now-album" data-i18n-content>{currentTrack.album}</span>}
          </div>
        </div>

        <div className="lh-radio-seek">
          <span ref={currentTimeRef} className="lh-radio-time">0:00</span>
          <input
            ref={seekRef}
            className="lh-radio-seek-input"
            type="range"
            min={0}
            max={0}
            step={0.1}
            defaultValue={0}
            aria-label="Seek"
            onPointerDown={() => { seekingRef.current = true }}
            onPointerUp={() => { seekingRef.current = false }}
            onInput={(e) => { const audio = audioRef.current; if (audio) audio.currentTime = Number((e.target as HTMLInputElement).value) }}
          />
          <span ref={durationRef} className="lh-radio-time">0:00</span>
        </div>

        <div className="lh-radio-controls">
          <button type="button" className="lh-radio-ctl" onClick={previous} aria-label="Previous track">◀</button>
          <button type="button" className="lh-radio-ctl lh-radio-ctl-primary" onClick={togglePlay} aria-label={state.isPlaying ? 'Pause' : 'Play'}>
            {state.isPlaying ? '❚❚' : '▶'}
          </button>
          <button type="button" className="lh-radio-ctl" onClick={next} aria-label="Next track">▶</button>
        </div>

        <div className="lh-radio-volume">
          <button type="button" className="lh-radio-vol-mute" onClick={() => dispatch({ type: 'muted', muted: !state.muted })} aria-label={state.muted ? 'Unmute' : 'Mute'}>
            {state.muted ? '🔇' : '🔊'}
          </button>
          <input
            className="lh-radio-volume-input"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.volume}
            aria-label="Volume"
            onChange={(e) => dispatch({ type: 'volume', volume: Number((e.target as HTMLInputElement).value) })}
          />
        </div>

        {state.error && (
          <div className="lh-radio-error" role="status">
            <span>{state.error}</span>
            <button type="button" className="lh-radio-link" onClick={next}>Skip ▶</button>
          </div>
        )}

        <div className="lh-radio-playlist">
          <span className="lh-radio-playlist-label">UP NEXT</span>
          {nextUp.length === 0 ? (
            <span className="lh-radio-playlist-empty">No tracks published yet.</span>
          ) : (
            <ol className="lh-radio-playlist-list">
              {nextUp.map((track, index) => (
                <li key={track.id}>
                  <button
                    type="button"
                    className={`lh-radio-playlist-item ${track.id === state.currentTrackId ? 'is-current' : ''}`}
                    onClick={() => playTrack(track.id)}
                  >
                    <span className="lh-radio-playlist-num">{index + 1}</span>
                    {track.artworkUrl ? (
                      <img className="lh-radio-playlist-cover" src={track.artworkUrl} alt="" />
                    ) : (
                      <span className="lh-radio-playlist-cover lh-radio-disc-fallback">♪</span>
                    )}
                    <span className="lh-radio-playlist-meta" data-i18n-content>
                      <strong>{track.title}</strong>
                      <small>{track.artist}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* ---- Collapsed capsule ---- */}
      <div className="lh-radio-capsule">
        <button type="button" className="lh-radio-capsule-main" onClick={() => dispatch({ type: 'open' })} aria-label="Open LH Radio">
          <span
            ref={progressRef}
            className="lh-radio-disc-progress"
            style={{ '--lh-radio-progress': '0%' } as CSSProperties}
            aria-hidden="true"
          >
            <span className="lh-radio-disc lh-radio-disc-small">
              {discArt ? (
                <img className="lh-radio-disc-art" src={discArt} alt="" />
              ) : (
                <span className="lh-radio-disc-fallback">♪</span>
              )}
              <span className="lh-radio-disc-hub" />
            </span>
          </span>
          <span className="lh-radio-capsule-text">
            <strong className="lh-radio-capsule-title" data-i18n-content={currentTrack ? true : undefined}>{currentTrack?.title ?? 'LH RADIO'}</strong>
            <small className="lh-radio-capsule-artist" data-i18n-content={currentTrack ? true : undefined}>{currentTrack?.artist ?? 'FOCUS MODE'}</small>
          </span>
        </button>
        <button type="button" className="lh-radio-capsule-btn" onClick={previous} aria-label="Previous track">◀</button>
        <button type="button" className="lh-radio-capsule-btn lh-radio-capsule-play" onClick={togglePlay} aria-label={state.isPlaying ? 'Pause' : 'Play'}>
          {state.isPlaying ? '❚❚' : '▶'}
        </button>
        <button type="button" className="lh-radio-capsule-btn" onClick={next} aria-label="Next track">▶</button>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
