import { describe, expect, it } from 'vitest'
import {
  isExternalHref,
  isModifiedClick,
  parseInternalTarget,
  shouldInterceptClick,
  type ClickLike,
} from './internalNavigation'

const BASE = 'https://localizationhub.app/'

function click(overrides: Partial<ClickLike> = {}): ClickLike {
  return { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 0, ...overrides }
}

describe('isExternalHref', () => {
  it('classifies same-origin routes as internal', () => {
    expect(isExternalHref('/app/projects', BASE)).toBe(false)
    expect(isExternalHref('/#product', BASE)).toBe(false)
    expect(isExternalHref('/download', BASE)).toBe(false)
  })

  it('classifies other origins and schemes as external', () => {
    expect(isExternalHref('https://github.com/dedwrite/LocalizationHub', BASE)).toBe(true)
    expect(isExternalHref('https://open.spotify.com/playlist/51C0wJDmneyIteIyDdztoU', BASE)).toBe(true)
    expect(isExternalHref('//cdn.example.com/x.js', BASE)).toBe(true)
    expect(isExternalHref('mailto:test@example.com', BASE)).toBe(true)
    expect(isExternalHref('javascript:void(0)', BASE)).toBe(true)
  })
})

describe('isModifiedClick', () => {
  it('detects modifier keys and non-primary buttons', () => {
    expect(isModifiedClick(click())).toBe(false)
    expect(isModifiedClick(click({ ctrlKey: true }))).toBe(true)
    expect(isModifiedClick(click({ metaKey: true }))).toBe(true)
    expect(isModifiedClick(click({ shiftKey: true }))).toBe(true)
    expect(isModifiedClick(click({ altKey: true }))).toBe(true)
    expect(isModifiedClick(click({ button: 1 }))).toBe(true)
  })
})

describe('parseInternalTarget', () => {
  it('returns path and hash for internal routes', () => {
    expect(parseInternalTarget('/app/projects', BASE)).toEqual({ path: '/app/projects', hash: '' })
    expect(parseInternalTarget('/#product', BASE)).toEqual({ path: '/', hash: '#product' })
    expect(parseInternalTarget('/download?x=1', BASE)).toEqual({ path: '/download?x=1', hash: '' })
  })

  it('returns null for external links and hash-only anchors', () => {
    expect(parseInternalTarget('https://github.com/dedwrite/LocalizationHub', BASE)).toBeNull()
    expect(parseInternalTarget('#product', BASE)).toBeNull()
  })
})

describe('shouldInterceptClick', () => {
  it('intercepts plain same-origin clicks', () => {
    expect(shouldInterceptClick(click(), '/download', BASE)).toBe(true)
    expect(shouldInterceptClick(click(), '/app/projects', BASE)).toBe(true)
  })

  it('does not intercept modified clicks, external links, or hash-only anchors', () => {
    expect(shouldInterceptClick(click({ metaKey: true }), '/download', BASE)).toBe(false)
    expect(shouldInterceptClick(click(), 'https://github.com/dedwrite/LocalizationHub', BASE)).toBe(false)
    expect(shouldInterceptClick(click(), '#product', BASE)).toBe(false)
  })
})
