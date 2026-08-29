/*
 * Public LH Radio catalog client.
 *
 * Fetches only the published track metadata. Audio and artwork are loaded
 * on demand by the player, never preloaded en masse.
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

export async function fetchRadioCatalog(): Promise<PublicRadioTrack[]> {
  const response = await fetch('/api/radio/tracks')
  if (!response.ok) {
    throw new Error('Could not load the radio catalog.')
  }
  const body = (await response.json()) as { tracks: PublicRadioTrack[] }
  return body.tracks ?? []
}
