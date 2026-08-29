import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useSpotifyIframe, type SpotifyEvent } from './useSpotifyIframe'
import { createInitialState, lhRadioReducer, saveOpenPreference } from './lhRadioState'
import { LH_RADIO_PLAYLIST_URL } from './spotifyPlaylist'
import './LhRadio.css'

/*
 * The single global LH Radio experience. Mounted once at the app shell level so
 * it survives SPA route transitions between Landing, Download, Web App, and
 * Workspace. Spotify's official playlist Embed is the playback source; this
 * component is only a LocalizationHub-branded shell around it.
 */
export default function LhRadio() {
  const [state, dispatch] = useReducer(lhRadioReducer, undefined, createInitialState)
  const [embedRequested, setEmbedRequested] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isAppSurface = typeof window !== 'undefined' && window.location.pathname.startsWith('/app')

  const handleEvent = useCallback((event: SpotifyEvent) => {
    if (event.type === 'ready') dispatch({ type: 'embed-status', status: 'ready' })
    else if (event.type === 'playback') dispatch({ type: 'playing-changed', playing: event.isPlaying })
    else if (event.type === 'error') dispatch({ type: 'embed-status', status: 'error', error: event.message })
    else if (event.type === 'autoplay-failed') dispatch({ type: 'embed-status', status: 'ready', error: 'Press play to start the radio.' })
  }, [])

  const { togglePlay } = useSpotifyIframe(containerRef, embedRequested, handleEvent)

  useEffect(() => {
    saveOpenPreference(state.isOpen)
  }, [state.isOpen])

  function requestEmbed() {
    setEmbedRequested(true)
  }

  function expand() {
    requestEmbed()
    dispatch({ type: 'open' })
  }

  function collapse() {
    dispatch({ type: 'close' })
  }

  function handleTogglePlay() {
    requestEmbed()
    dispatch({ type: 'mark-started' })
    togglePlay()
  }

  const playing = state.isPlaying
  const error = state.embedStatus === 'error'
  const playLabel = playing ? 'Pause' : 'Play'

  return (
    <div
      className={`lh-radio ${state.isOpen ? 'is-open' : 'is-collapsed'} ${playing ? 'is-playing' : ''}`}
      data-surface={isAppSurface ? 'app' : 'public'}
      data-embed-status={state.embedStatus}
    >
      <section className="lh-radio-panel" role="region" aria-label="LH Radio player" aria-hidden={!state.isOpen}>
        <header className="lh-radio-panel-head">
          <div className="lh-radio-panel-title">
            <span className="lh-radio-kicker">LH RADIO</span>
            <span className="lh-radio-sub">SPOTIFY PLAYLIST</span>
          </div>
          <div className="lh-radio-panel-actions">
            <button type="button" className="lh-radio-icon-btn" onClick={handleTogglePlay} aria-label={playLabel}>
              {playing ? '❚❚' : '▶'}
            </button>
            <button type="button" className="lh-radio-icon-btn" onClick={collapse} aria-label="Collapse LH Radio">–</button>
          </div>
        </header>

        <div className="lh-radio-embed-wrap">
          <div ref={containerRef} className="lh-radio-embed" />
          {error && (
            <div className="lh-radio-fallback" role="status">
              <p className="lh-radio-fallback-title">Spotify unavailable</p>
              <p className="lh-radio-fallback-note">{state.error ?? 'The playlist could not be loaded.'}</p>
              <a className="lh-radio-link" href={LH_RADIO_PLAYLIST_URL} target="_blank" rel="noopener noreferrer">Open playlist ↗</a>
            </div>
          )}
          {state.embedStatus !== 'ready' && !error && (
            <div className="lh-radio-loading" role="status">Loading Spotify…</div>
          )}
        </div>

        <footer className="lh-radio-panel-foot">
          <span className="lh-radio-foot-label">LOCALIZATIONHUB / FOCUS MODE</span>
          <a className="lh-radio-link" href={LH_RADIO_PLAYLIST_URL} target="_blank" rel="noopener noreferrer">Open in Spotify ↗</a>
        </footer>
      </section>

      <div className="lh-radio-capsule">
        <button type="button" className="lh-radio-capsule-main" onClick={expand} aria-label="Open LH Radio">
          <span className="lh-radio-eq" aria-hidden="true">
            <span /><span /><span />
          </span>
          <span className="lh-radio-capsule-text">
            <strong className="lh-radio-name">LH RADIO</strong>
            <small className="lh-radio-meta">
              {error ? 'Spotify unavailable' : playing ? 'Now playing' : 'FOCUS MODE'}
            </small>
          </span>
        </button>
        <a className="lh-radio-attribution" href={LH_RADIO_PLAYLIST_URL} target="_blank" rel="noopener noreferrer" aria-label="Open playlist on Spotify">Spotify</a>
        <button type="button" className="lh-radio-play" onClick={handleTogglePlay} aria-label={`${playing ? 'Pause' : 'Play'} LH Radio`}>
          {playing ? '❚❚' : '▶'}
        </button>
      </div>
    </div>
  )
}
