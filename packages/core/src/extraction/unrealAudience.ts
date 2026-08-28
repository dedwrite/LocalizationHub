/*
 * Unreal LOCRES runtime-vs-engine audience classifier.
 *
 * A game `.pak` ships two kinds of localization resources:
 *
 *   - Game-authored content under `<Project>/Content/Localization/<Target>/`
 *     (VOIN's `Game.locres`, `ST_UI`/`ST_Items`/`ST_Voicelines`/…). These are
 *     the strings a player sees in-game — runtime, included by default.
 *   - Engine/plugin stock under `Engine/Content/Localization/…` and
 *     `Engine/Plugins/…/Content/Localization/…` (Unreal Editor, MetaSound,
 *     Niagara, InputKeys, marketplace plugins like XeSS). These are shipped
 *     with the engine, not authored by the game, and are NOT player-facing
 *     game content — developer, excluded by default.
 *
 * This mirrors the Godot runtime-vs-editor classifier: proven tooling is
 * auto-excluded (never deleted), runtime/unknown stay included.
 */

import type { ContentAudience } from './types'
import type { AudienceResult } from './godotAudience'

/* A path segment named `engine` (the engine's own content root, plus every
 * plugin under `Engine/Plugins/…`). Project-relative paths only. */
const ENGINE_PATH_PATTERN = /(^|\/)engine(\/|$)/iu

/* Test/example/sample/demo localization collections. `STestSuite` and
 * `AutomationTest` live in Engine.locres (already engine-excluded), but a game
 * may also carry a `Test` key in an otherwise-runtime namespace. */
const TEST_NAMESPACE_PATTERN = /^(tests?|stestsuite|automationtest|examples?|samples?|demos?)$/iu
const TEST_KEY_PATTERN = /^(test|tests|example|sample|demo|dummy|placeholder)$/iu

/*
 * Classify a single LOCRES entry's audience from its project-relative file
 * path plus its namespace/key. Engine/plugin paths win over everything (the
 * whole file is engine stock); within game content, only explicit test markers
 * are excluded.
 */
export function classifyUnrealLocresAudience(
  relativePath: string,
  namespace?: string,
  key?: string,
): AudienceResult {
  if (ENGINE_PATH_PATTERN.test(relativePath)) {
    return { audience: 'developer', reason: 'unreal-engine-localization' }
  }
  if (namespace && TEST_NAMESPACE_PATTERN.test(namespace)) {
    return { audience: 'test', reason: 'test-resource' }
  }
  if (key && TEST_KEY_PATTERN.test(key)) {
    return { audience: 'test', reason: 'test-resource' }
  }
  return { audience: 'runtime' }
}
