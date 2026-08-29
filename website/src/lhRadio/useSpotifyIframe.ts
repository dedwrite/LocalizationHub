import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { loadSpotifyIframeApi, type SpotifyEmbedController } from './spotifyIframe'
import { LH_RADIO_PLAYLIST_URI, SPOTIFY_IFRAME_API_URL, SPOTIFY_IFRAME_LOAD_TIMEOUT_MS } from './spotifyPlaylist'

export type SpotifyEvent =
  | { type: 'ready' }
  | { type: 'playback'; isPlaying: boolean }
  | { type: 'error'; message: string }
  | { type: 'autoplay-failed' }

/*
 * Bridges Spotify's official Embed/iFrame API to React.
 *
 * The embed is created lazily (only once `enabled` is true, i.e. the user has
 * opened the radio or pressed play). Playback is never started automatically:
 * `play`/`togglePlay` are only ever invoked from a user gesture.
 */
export function useSpotifyIframe(
  containerRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  onEvent: (event: SpotifyEvent) => void,
) {
  const controllerRef = useRef<SpotifyEmbedController | null>(null)
  const playRequestedRef = useRef(false)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    loadSpotifyIframeApi(SPOTIFY_IFRAME_API_URL, SPOTIFY_IFRAME_LOAD_TIMEOUT_MS)
      .then((api) => {
        if (cancelled) return
        api.createController(container, { uri: LH_RADIO_PLAYLIST_URI, width: '100%', height: 352 }, (controller) => {
          if (cancelled) {
            controller.destroy()
            return
          }
          controllerRef.current = controller

          controller.addListener('ready', () => {
            if (cancelled) return
            onEventRef.current({ type: 'ready' })
            if (playRequestedRef.current) {
              playRequestedRef.current = false
              controller.play()
            }
          })

          controller.addListener('playback_update', (data) => {
            if (cancelled) return
            onEventRef.current({ type: 'playback', isPlaying: isPlaybackActive(data) })
          })

          controller.addListener('playback_state_changed', (data) => {
            if (cancelled) return
            onEventRef.current({ type: 'playback', isPlaying: isPlaybackActive(data) })
          })

          controller.addListener('error', () => {
            if (cancelled) return
            onEventRef.current({ type: 'error', message: 'Spotify embed reported an error.' })
          })

          controller.addListener('autoplay_failed', () => {
            if (cancelled) return
            onEventRef.current({ type: 'autoplay-failed' })
          })
        })
      })
      .catch(() => {
        if (cancelled) return
        onEventRef.current({ type: 'error', message: 'Spotify is unavailable.' })
      })

    return () => {
      cancelled = true
      if (controllerRef.current) {
        controllerRef.current.destroy()
        controllerRef.current = null
      }
    }
  }, [enabled, containerRef])

  const play = useCallback(() => {
    if (controllerRef.current) controllerRef.current.play()
    else playRequestedRef.current = true
  }, [])

  const pause = useCallback(() => {
    playRequestedRef.current = false
    controllerRef.current?.pause()
  }, [])

  const togglePlay = useCallback(() => {
    if (controllerRef.current) controllerRef.current.togglePlay()
    else playRequestedRef.current = true
  }, [])

  return { play, pause, togglePlay }
}

function isPlaybackActive(data: unknown): boolean {
  const value = data as { isPaused?: boolean } | undefined
  return value?.isPaused === false
}
