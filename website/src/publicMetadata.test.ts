import { describe, expect, it } from 'vitest'
import { metadataFor, publicMetadata } from './publicMetadata'

describe('route-specific public metadata', () => {
  it('gives every prerendered public page its own canonical and description', () => {
    const titles = new Set<string>()
    for (const [path, page] of Object.entries(publicMetadata)) {
      const meta = metadataFor(path)
      expect(meta.canonical).toBe(`https://localizationhub.app${path}`)
      expect(meta.description).toBe(page.description)
      expect(meta.robots).toBe('index, follow')
      expect(meta.image).toBe('https://localizationhub.app/og-card.png')
      titles.add(meta.title)
    }
    expect(titles.size).toBe(Object.keys(publicMetadata).length)
  })
  it('does not present private workspace routes as indexable product pages', () => {
    for (const path of ['/app', '/app/local', '/app/projects/project-1', '/app/admin/radio']) {
      expect(metadataFor(path)).toMatchObject({ title: 'Workspace — LocalizationHub', robots: 'noindex, nofollow' })
    }
    expect(metadataFor('/missing')).toMatchObject({ title: 'Workspace — LocalizationHub', robots: 'noindex, follow' })
  })
})
