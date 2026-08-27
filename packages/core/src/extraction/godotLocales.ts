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
  /* Culture-independent story path (everything after `locales/<culture>/`). */
  storyPath: string
  /* Locale code from the `locales/<culture>/` segment, when present. */
  locale?: string
}

const INKB_LOCALE_PATTERN = /(?:^|\/)locales\/([^/]+)\/(.+)$/u

/*
 * Extract the locale + culture-independent story path from a `.inkb` path.
 *
 * `.../story/locales/ja/1/1c/1c.inkb` → { locale: "ja", storyPath: "1/1c/1c" }
 * `1/1c/1c.inkb` (no locales segment) → { storyPath: "1/1c/1c" }
 */
export function detectGodotInkbLocale(fileName: string): GodotInkbLocale {
  const normalized = fileName.replace(/\\/g, '/')
  const match = normalized.match(INKB_LOCALE_PATTERN)
  if (match) {
    return { locale: match[1].toLowerCase(), storyPath: match[2].replace(/\.inkb$/iu, '') }
  }
  return { storyPath: normalized.replace(/\.inkb$/iu, '') }
}
