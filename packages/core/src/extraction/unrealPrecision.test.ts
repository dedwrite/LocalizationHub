/*
 * Unreal LOCRES precision integration tests.
 *
 * Mirrors the Godot runtime-vs-editor precision guarantees for Unreal:
 *   - game-authored content (`<Project>/Content/Localization/…`) is included
 *   - engine/plugin stock (`Engine/…`) is auto-excluded (developer)
 *   - test markers inside game content are auto-excluded (test)
 */

import { describe, expect, it } from 'vitest'
import { extractUnrealLocres } from './engines/unreal'
import { classifyUnrealLocresAudience } from './unrealAudience'
import { buildCompactLocres } from './locres.fixtures'

describe('classifyUnrealLocresAudience', () => {
  it('marks engine/plugin paths as developer (excluded)', () => {
    expect(classifyUnrealLocresAudience('Engine/Content/Localization/Engine/en/Engine.locres', 'UnrealEd', 'SomeKey'))
      .toEqual({ audience: 'developer', reason: 'unreal-engine-localization' })
    expect(classifyUnrealLocresAudience('Engine/Plugins/Marketplace/XeSS_UE5.6_Plugin_v2.0.10/Content/Localization/XeSS/en/XeSS.locres', 'XeSSStringTable', 'XESS_LABEL'))
      .toEqual({ audience: 'developer', reason: 'unreal-engine-localization' })
  })

  it('marks test namespaces/keys as test (excluded)', () => {
    expect(classifyUnrealLocresAudience('VOIN/Content/Localization/Game/en-US/Game.locres', 'STestSuite', 'x'))
      .toEqual({ audience: 'test', reason: 'test-resource' })
    expect(classifyUnrealLocresAudience('VOIN/Content/Localization/Game/en-US/Game.locres', 'ST_Dialogues', 'Test'))
      .toEqual({ audience: 'test', reason: 'test-resource' })
  })

  it('keeps game-authored runtime content included', () => {
    expect(classifyUnrealLocresAudience('VOIN/Content/Localization/Game/en-US/Game.locres', 'ST_UI', 'MainMenu'))
      .toEqual({ audience: 'runtime' })
    expect(classifyUnrealLocresAudience('VOIN/Content/Localization/Game/en-US/Game.locres', 'ST_Items', 'sword_name'))
      .toEqual({ audience: 'runtime' })
  })
})

describe('extractUnrealLocres audience attachment', () => {
  it('auto-excludes engine stock and test markers, keeps game runtime', () => {
    const game = buildCompactLocres([
      { namespace: 'ST_UI', keys: [{ key: 'MainMenu', localized: 'Main Menu' }] },
      { namespace: 'ST_Items', keys: [{ key: 'sword_name', localized: 'Sword' }] },
      { namespace: 'ST_Dialogues', keys: [{ key: 'Test', localized: 'Hello?' }] },
    ])
    const engine = buildCompactLocres([
      { namespace: 'UnrealEd', keys: [{ key: 'SaveAsset', localized: 'Save Asset' }] },
    ])

    const gameResult = extractUnrealLocres({ fileName: 'VOIN/Content/Localization/Game/en-US/Game.locres', buffer: game })
    const ui = gameResult.entries.find((e) => e.key === 'MainMenu')
    const item = gameResult.entries.find((e) => e.key === 'sword_name')
    const test = gameResult.entries.find((e) => e.key === 'Test')
    expect(ui?.excludedByDefault).toBeUndefined()
    expect(item?.excludedByDefault).toBeUndefined()
    // Runtime entries carry no exclusion; contentAudience stays undefined
    // (treated as runtime), matching the Godot audience contract.
    expect(ui?.contentAudience).toBeUndefined()
    expect(test?.excludedByDefault).toBe(true)
    expect(test?.exclusionReason).toBe('test-resource')
    expect(test?.contentAudience).toBe('test')

    const engineResult = extractUnrealLocres({ fileName: 'Engine/Content/Localization/Engine/en/Engine.locres', buffer: engine })
    expect(engineResult.entries).toHaveLength(1)
    expect(engineResult.entries[0].excludedByDefault).toBe(true)
    expect(engineResult.entries[0].exclusionReason).toBe('unreal-engine-localization')
    expect(engineResult.entries[0].contentAudience).toBe('developer')
  })
})
