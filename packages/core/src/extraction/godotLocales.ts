/*
 * Godot locale detection from file paths (extraction only).
 *
 * Godot projects commonly encode a locale in resource paths or filenames:
 *
 *   JSON databases:  fb.json          → base/source (no locale suffix)
 *                     fb_ja.json       → locale "ja"
 *                     fb_zh-CN.json    → locale "zh-CN"
 *
 *   Ink story files:  story/locales/ja/1/1c/1c.inkb   → locale "ja"
 *                     story/locales/fr/1/1c/1c.inkb   → locale "fr"
 *
 * The culture-INDEPENDENT identity is everything except the locale marker:
 *   - `fb.json` and `fb_ja.json` share base name "fb"
 *   - `locales/ja/1/1c/1c.inkb` and `locales/fr/1/1c/1c.inkb` share story "1/1c/1c"
 *
 * Locale is only ever reported when the path itself proves it — never guessed.
 */

export type GodotJsonLocale = {
  /* Culture-independent database name (e.g. "fb", "email"). */
  baseName: string
  /* BCP-47-ish locale code when the filename has a locale suffix. */
  locale?: string
  /* True when this is the base (unsuffixed, source) file. */
  isBase: boolean
}

/*
 * Match a Godot JSON database filename against the locale-suffix convention.
 *
 * Base:      fb.json               → { baseName: "fb", isBase: true }
 * Locale:    fb_ja.json            → { baseName: "fb", locale: "ja" }
 *            fb_zh-CN.json         → { baseName: "fb", locale: "zh-CN" }
 *            characters_fil.json   → { baseName: "characters", locale: "fil" }
 */
export function detectGodotJsonLocale(fileName: string): GodotJsonLocale {
  const withoutExt = fileName.replace(/\.json$/iu, '')
  // A locale suffix is `_xx` or `_xx-YY` (2–3 letter language, optional region).
  const match = withoutExt.match(/^(.*?)_([a-z]{2,3}(?:-[A-Z]{2})?)$/u)
  if (match) {
    return { baseName: match[1], locale: match[2].toLowerCase(), isBase: false }
  }
  return { baseName: withoutExt, isBase: true }
}

export type GodotInkbLocale = {
  /* Culture-independent story path (relative to the story root, `res://assets/story`). */
  storyPath: string
  /* Locale code from the `locales/<culture>/` segment, when present. */
  locale?: string
  /* True when this is the base (unsuffixed, source-language) story. */
  isBase?: boolean
}

/*
 * Extract the locale + culture-independent story path from a `.inkb` path.
 *
 * The story root is `res://assets/story` (or any path ending in `story/`):
 *
 *   assets/story/1/1c/1c.inkb                  → { storyPath: "1/1c/1c", isBase: true }
 *   assets/story/locales/ja/1/1c/1c.inkb       → { locale: "ja", storyPath: "1/1c/1c" }
 *   f/assets/story/locales/ja/1/1c/1c.inkb     → { locale: "ja", storyPath: "1/1c/1c" }
 *   1/1c/1c.inkb (no story root)               → { storyPath: "1/1c/1c" }
 *
 * Both the base story and its `locales/<culture>/` overlays therefore share the
 * SAME storyPath, so they aggregate into one logical identity.
 */
export function detectGodotInkbLocale(fileName: string): GodotInkbLocale {
  const normalized = fileName.replace(/\\/g, '/').replace(/\.inkb$/iu, '')

  // Strip any leading story-root prefix (`.../assets/story/` or `.../story/`).
  let relative = normalized
  const storyRoot = normalized.match(/^(?:.*\/)?(?:assets\/)?story\/(.+)$/u)
  if (storyRoot) {
    relative = storyRoot[1]
  }

  // A locale overlay is `locales/<culture>/<rest>`.
  const localeMatch = relative.match(/^locales\/([^/]+)\/(.+)$/u)
  if (localeMatch) {
    return { locale: localeMatch[1].toLowerCase(), storyPath: localeMatch[2] }
  }

  return { storyPath: relative, isBase: true }
}
