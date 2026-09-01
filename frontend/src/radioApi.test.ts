import { describe, expect, it, vi } from 'vitest'

vi.mock('./runtimeConfig', () => ({
  getCloudApiBaseUrl: () => 'https://localizationhub.app',
}))

import { fetchRadioCatalog, resolveRadioMediaUrl } from './radioApi'

describe('desktop radioApi', () => {
  it('resolves relative media paths against the Cloud API base', () => {
    expect(resolveRadioMediaUrl('/api/radio/tracks/a/audio')).toBe('https://localizationhub.app/api/radio/tracks/a/audio')
    expect(resolveRadioMediaUrl('https://cdn.example/audio.mp3')).toBe('https://cdn.example/audio.mp3')
  })

  it('rewrites catalog media URLs after fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tracks: [{
          id: 't1',
          title: 'Quiet review',
          artist: 'Studio',
          album: null,
          position: 0,
          durationSeconds: 120,
          artworkUrl: '/api/radio/tracks/t1/artwork',
          audioUrl: '/api/radio/tracks/t1/audio',
        }],
      }),
    })))

    const tracks = await fetchRadioCatalog()
    expect(tracks[0].audioUrl).toBe('https://localizationhub.app/api/radio/tracks/t1/audio')
    expect(tracks[0].artworkUrl).toBe('https://localizationhub.app/api/radio/tracks/t1/artwork')
  })
})
