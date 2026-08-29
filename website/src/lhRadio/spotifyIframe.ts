// Types and a small loader for Spotify's official Embed / iFrame API.
//
// We use the supported Embed/iFrame controller contract only — never the Web
// Playback SDK, never OAuth, never locally cached audio.

export interface SpotifyEmbedController {
  loadUri(uri: string): void
  togglePlay(): void
  play(): void
  pause(): void
  destroy(): void
  addListener(eventName: string, callback: (data: unknown) => void): void
}

export interface SpotifyIframeApi {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: number | string; height?: number | string },
    callback: (controller: SpotifyEmbedController) => void,
  ): void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void
  }
}

const SCRIPT_ID = 'lh-radio-spotify-iframe-api'

let apiPromise: Promise<SpotifyIframeApi> | null = null

/*
 * Loads Spotify's Embed/iFrame API exactly once per page session and resolves
 * with the API object. The script reports readiness by invoking
 * `window.onSpotifyIframeApiReady`; a timeout and the script's `onerror` both
 * resolve to a rejection so callers can render a fallback.
 */
export function loadSpotifyIframeApi(scriptUrl: string, timeoutMs: number): Promise<SpotifyIframeApi> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    let settled = false

    function finish(api?: SpotifyIframeApi) {
      if (settled) return
      settled = true
      if (api) resolve(api)
      else reject(new Error('Spotify embed failed to load.'))
    }

    const timer = window.setTimeout(() => finish(), timeoutMs)

    window.onSpotifyIframeApiReady = (api) => {
      window.clearTimeout(timer)
      finish(api)
    }

    if (document.getElementById(SCRIPT_ID)) return

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = scriptUrl
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timer)
      finish()
    }
    document.head.appendChild(script)
  })
  return apiPromise
}
