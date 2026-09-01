import { getCloudApiBaseUrl } from './runtimeConfig'

/*
 * Public LH Radio catalog client for the desktop app.
 * Relative media paths from the Cloud API are rewritten to absolute URLs
 * against the configured Cloud API base (production or local relay).
 */

export type PublicRadioTrack = {
  id: string
  title: string
  artist: string
  album: string | null
  position: number
  durationSeconds: number | null
  artworkUrl: string
  audioUrl: string
}

export function resolveRadioMediaUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const base = getCloudApiBaseUrl().replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function fetchRadioCatalog(): Promise<PublicRadioTrack[]> {
  const base = getCloudApiBaseUrl().replace(/\/+$/, '')
  const response = await fetch(`${base}/api/radio/tracks`)
  if (!response.ok) {
    throw new Error('Could not load the radio catalog.')
  }
  const body = (await response.json()) as { tracks: PublicRadioTrack[] }
  return (body.tracks ?? []).map((track) => ({
    ...track,
    artworkUrl: resolveRadioMediaUrl(track.artworkUrl),
    audioUrl: resolveRadioMediaUrl(track.audioUrl),
  }))
}
