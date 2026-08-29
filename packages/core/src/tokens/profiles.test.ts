import { describe, expect, it } from 'vitest'
import {
  createTokenProfileConfig,
  displayTokenProfile,
  resolveTokenProfile,
} from './profiles'
import { extractProtectedTokens } from './index'

describe('engine-aware token profiles', () => {
  it('resolves Auto from authoritative detection without changing mode', () => {
    const config = createTokenProfileConfig('auto', { engine: 'unity', confidence: 'high', evidence: ['extraction'] })
    expect(config.mode).toBe('auto')
    expect(config.resolvedProfile).toBe('unity')
    expect(displayTokenProfile(config)).toBe('Auto · Unity')
  })

  it('manual selection always wins over detection', () => {
    expect(resolveTokenProfile('godot', { engine: 'unity', confidence: 'high', evidence: [] })).toBe('godot')
  })

  it('falls back conservatively to Generic', () => {
    const config = createTokenProfileConfig('auto')
    expect(config.resolvedProfile).toBe('generic')
  })

  it('protects nested Unity Smart Strings without crashing', () => {
    const source = 'I have {0:plural:one {Name}|other {{Count} items}}.'
    expect(extractProtectedTokens(source, 'unity').map((item) => item.raw)).toEqual([
      '{0:plural:one {Name}|other {{Count} items}}',
    ])
  })

  it('protects documented Unreal modifiers as one structural token', () => {
    const source = '{NumCats}|plural(one=cat,other=cats)'
    expect(extractProtectedTokens(source, 'unreal').map((item) => item.raw)).toContain(source)
  })

  it('does not protect ordinary prose or numeric percent words as generic tokens', () => {
    expect(extractProtectedTokens('Use 100%discount today.', 'generic')).toEqual([])
    expect(extractProtectedTokens('Braces { around prose } and < 3 apples.', 'generic')).toEqual([])
  })

  it('keeps RTL text while protecting structural spans', () => {
    const tokens = extractProtectedTokens('مرحبا {PlayerName} <color=#FF0000>{0:N2}</color>', 'unity')
    expect(tokens.map((item) => item.raw)).toEqual(['{PlayerName}', '<color=#FF0000>', '{0:N2}', '</color>'])
  })

  it('leaves malformed nested syntax as text rather than throwing', () => {
    expect(() => extractProtectedTokens('Unclosed {0:plural:one|other', 'unity')).not.toThrow()
  })
})

