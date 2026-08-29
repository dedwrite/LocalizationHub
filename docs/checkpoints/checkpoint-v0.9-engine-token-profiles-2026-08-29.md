# LocalizationHub v0.9 Engine-Aware Token Profiles Checkpoint

Date: 2026-08-29  
Branch: `feature/v0.9-engine-token-profiles`  
Implementation commit: `ccf709772115aaac3d317cb16228e1dee2654de9`  
Starting stable main: `0cc482571686bc5fcf50710ca9aa360f87e2f59a`

## Scope

This focused batch completes engine-aware protected-token profiles for the
Desktop and Web App surfaces through the shared core. It does not implement
engine reinjection, rebuilding, round-tripping, extraction redesign, or a v0.9
release. Arabic UI localization remains out of scope.

## Architecture

Engine detection, token-profile resolution, and protected-token scanning remain
separate layers. The shared core owns profile IDs/configuration, detection,
resolution, balanced scanners, and validation. Desktop and Web consume the same
resolved profile rather than maintaining independent token rules.

Profiles exposed by the UI are Auto, Generic, Godot, Unreal Engine, and Unity.
The additive `tokenProfileConfig` stores `mode`, optional manual selection,
resolved profile, and compact detection evidence while retaining the existing
`tokenProfile` field for Project V3 compatibility.

## Profile coverage

- Generic: printf placeholders (`%s`, `%d`, `%i`, `%f`, width/position forms),
  positional and named braces, `${name}`, `{{name}}`, and `\\n`, `\\r`, `\\t`,
  with prose false-positive guards.
- Godot: existing accepted printf/named/positional formatting, BBCode-style
  markup, escapes, and established Godot-specific rules. Existing behavior was
  preserved; no broadening was introduced without tests.
- Unreal Engine: balanced FText positional/named arguments, documented
  `plural`, `ordinal`, `gender`, and `hpp` modifiers, rich-text tags, string
  table references, printf forms, and escapes. Nested modifier scanning is
  deterministic and malformed input is conservative.
- Unity: composite formatting, named Smart String expressions with balanced
  nested braces, Smart String selectors/plural constructs, TextMeshPro tags
  including sprite/size/color forms, and escapes.

Official references used for the Unreal and Unity syntax summaries:
[Epic's Text Localization documentation](https://dev.epicgames.com/documentation/unreal-engine/text-localization-in-unreal-engine),
[Unity Smart Strings](https://docs.unity3d.com/Packages/com.unity.localization@1.4/manual/Smart/SmartStrings.html),
[Unity plural formatter](https://docs.unity3d.com/Packages/com.unity.localization@1.4/manual/Smart/Plural-Formatter.html),
and [Unity choose formatter](https://docs.unity3d.com/Packages/com.unity.localization@1.4/manual/Smart/Choose-Formatter.html).

## Detection and resolution

Detection precedence is authoritative extraction metadata first, then strong
engine/file/content evidence. Authoritative supported extraction metadata is
high confidence and wins over text heuristics. Multiple consistent structural
signals are medium confidence; weak content signatures are low confidence;
ties and no evidence are unknown/low and resolve Auto to Generic. Evidence is
bounded to a small list for project persistence.

Auto keeps `mode: auto` while resolving to the detected Godot, Unreal, Unity,
or Generic profile. Manual selection always wins and persists. A manual choice
that differs from detected high-confidence evidence shows a non-blocking
mismatch warning with an option to use the detected profile. Unknown Auto state
shows a compact Generic fallback notice.

## Compatibility and known limitations

Existing V1/V2/V3 projects continue to open. An old explicit profile (for
example `godot`) is treated as a manual choice; it is not silently converted to
Auto. New projects and extracted projects default to Auto. The profile scanner
is intentionally conservative for ambiguous syntax and does not claim to
recognize every engine-specific asset or formatter. Rich-text inner text stays
translatable while tags/attributes are protected. No new engine profiles or
Arabic UI strings were added.

## Final gates

- Core Vitest: 301 tests passed (`npx vitest run packages/core/src`).
- Combined frontend/website/core Vitest: 376 tests passed.
- Collaboration server: 137 tests passed.
- Website and Desktop frontend production builds passed.
- Rust: 13 Cargo tests passed; `cargo check` passed.
- Performance suite: 1 test passed.
- Full Playwright: 809 passed, 105 skipped, 0 failed (914 total).
- Node syntax checks for collaboration server and Radio modules passed.
- `git diff --check` passed (only line-ending normalization warnings).

