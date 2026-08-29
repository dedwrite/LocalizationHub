# Engine-aware token profiles

LocalizationHub keeps engine detection, profile resolution, and protected-token
scanning as separate steps. The shared `@localizationhub/core` package owns the
profiles and scanner so Desktop and Web use the same semantics.

## Profiles

- **Generic** protects conservative named/positional braces (`{name}`, `{0}`),
  `${name}`, `{{name}}`, printf formats (`%s`, `%02d`, `%1$s`), supported escape
  sequences, HTML-like/BBCode tags, and percent variables. Numeric prose such as
  `100%discount` is intentionally not treated as a format token.
- **Godot** inherits Generic and retains the accepted Godot commands (`[$ ...]`,
  line commands beginning with `$` or `->`, `::` markers), percent references,
  formatting, escaped percent, and punctuation control markers. Existing Godot
  recognition is otherwise unchanged.
- **Unreal Engine** inherits Generic and adds balanced FText argument modifiers
  (`{Count}|plural(one=cat,other=cats)`, `|ordinal`, `|gender`, `|hpp`), the
  inline rich-text close marker `</>`, and `LOCTABLE(...)` references. These are
  based on Epic's FText formatting documentation:
  [Text Localization in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/text-localization-in-unreal-engine).
- **Unity** inherits Generic and adds balanced Smart String expressions (nested
  selectors/formatters such as `{0:plural:one item|{} items}`), empty Smart String
  placeholders, and TextMesh Pro markup/sprite tags. The syntax is based on the
  Unity Localization [Smart String documentation](https://docs.unity3d.com/Packages/com.unity.localization@1.4/manual/Smart/SmartStrings.html),
  [plural formatter](https://docs.unity3d.com/Packages/com.unity.localization@1.4/manual/Smart/Plural-Formatter.html),
  and [choose formatter](https://docs.unity3d.com/Packages/com.unity.localization@1.4/manual/Smart/Choose-Formatter.html).

Tags and attributes are protected; text between paired tags remains translatable.
Malformed or unbalanced syntax is left as text and never throws.

## Auto detection and resolution

Detection precedence is deterministic:

1. authoritative extraction metadata;
2. strong project/file structure (`project.godot`, Unreal resources, Unity
   `*_Data` plus serialized assets/signature files);
3. multiple consistent structural signals;
4. multiple content signatures;
5. unknown → Generic.

High confidence means authoritative metadata or a strong unambiguous structure.
Medium means several consistent signals. Low means weak content evidence or no
reliable signal. A single overlapping placeholder never claims an engine.

Auto persists `mode: auto`, a bounded `engineDetection` summary, and the
separate `resolvedProfile`. Manual Generic/Godot/Unreal Engine/Unity selection
always wins and is never silently replaced. Users can return to Auto. A manual
selection that differs from a detected engine receives a non-blocking warning.

Existing V1/V2/V3 projects remain readable. An old explicit `tokenProfile` is
treated as a manual choice; new projects default to Auto. Project format V3 is
not bumped.

