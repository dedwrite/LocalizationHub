// Fixed product configuration for the initial LH Radio integration.
//
// LH Radio is a LocalizationHub-branded shell around Spotify's official
// playlist Embed. The playlist below is the single source of truth for the
// radio — nothing else in the app may point at a different playlist.

export const LH_RADIO_PLAYLIST_ID = '51C0wJDmneyIteIyDdztoU'
export const LH_RADIO_PLAYLIST_URI = `spotify:playlist:${LH_RADIO_PLAYLIST_ID}`
export const LH_RADIO_PLAYLIST_URL = `https://open.spotify.com/playlist/${LH_RADIO_PLAYLIST_ID}`

// Spotify's official Embed / iFrame API entry point.
export const SPOTIFY_IFRAME_API_URL = 'https://open.spotify.com/embed/iframe-api/v1'

// How long to wait for the Spotify script before surfacing the fallback.
export const SPOTIFY_IFRAME_LOAD_TIMEOUT_MS = 15_000
