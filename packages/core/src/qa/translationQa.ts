import { extractProtectedTokens } from '../tokens'
import type { ProtectedToken, TokenProfileId } from '../tokens/types'

/*
 * Quality checks that compare the translation against its own source, next to
 * the protected-token validation. The token validator answers "will this break
 * the build"; these answer "did the translator lose something the source
 * carried" — a number, a line break, a question mark, an entity, an edge space.
 *
 * Every check is protected-token aware: a number inside `{count}` or a tag
 * inside `[shake]` belongs to the token validator, never here. Checks that can
 * only fire on one side (numbers, terminal punctuation) stay conservative and
 * say so rather than guessing intent.
 */

export type QaIssueKind =
  | 'invisible-characters'
  | 'replacement-character'
  | 'newline-dropped'
  | 'newline-added'
  | 'edge-space-dropped'
  | 'edge-space-added'
  | 'terminal-punctuation-dropped'
  | 'number-dropped'
  | 'number-added'
  | 'entity-mismatch'
  | 'duplicate-translation'

export type QaIssue = {
  kind: QaIssueKind
  severity: 'error' | 'warning'
  message: string
  /* The concrete value behind the message: a code point, a number, a tag, the
   * other source a duplicate shares its translation with. */
  detail?: string
}

/* Direction marks, joiners, zero-width spaces and the BOM: invisible in the
 * editor, exported verbatim, and painful to debug in a game. */
const INVISIBLE_CHARACTERS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/gu
const REPLACEMENT_CHARACTER = '\uFFFD'
const TERMINAL_PUNCTUATION = new Set(['.', '!', '?', ':', ';', '…', '؟', '؛', '۔', '。', '！', '？', '：', '；'])
/* Markup tags are already protected tokens in every profile, so the markup
 * check here covers the piece the validator does not: entities. */
const ENTITY = /&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\d{1,7}|#x[0-9A-Fa-f]{1,6});/gu

/** Blank protected tokens so only the translator's own text is compared. */
function blankTokens(text: string, tokens: ProtectedToken[]): string {
  if (tokens.length === 0) return text
  let result = ''
  let cursor = 0
  for (const token of tokens) {
    result += text.slice(cursor, token.start) + ' '.repeat(Math.max(0, token.end - token.start))
    cursor = token.end
  }
  return result + text.slice(cursor)
}

/*
 * Edge spaces are compared on the raw text, and only when that edge is not a
 * protected token: `[shake]Hi[/shake]` has no space to lose, while a real
 * trailing space before an export matters.
 */
function edgeWhitespace(text: string, tokens: ProtectedToken[]): { leading: string | null; trailing: string | null } {
  const startsWithToken = tokens.some((token) => token.start === 0)
  const endsWithToken = tokens.some((token) => token.end === text.length)
  return {
    leading: startsWithToken ? null : text.match(/^[ \t]+/u)?.[0] ?? '',
    trailing: endsWithToken ? null : text.match(/[ \t]+$/u)?.[0] ?? '',
  }
}

/** Digits in any numeral system the tool ingests, compared as one script. */
function normalizeDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/gu, (character) => {
    const code = character.codePointAt(0) ?? 0
    return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660)
  })
}

function numberCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const match of normalizeDigits(text).matchAll(/\d+/gu)) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1)
  return counts
}

function entityCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const match of text.matchAll(ENTITY)) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1)
  return counts
}

function missingValues(source: Map<string, number>, translation: Map<string, number>): string[] {
  const missing: string[] = []
  for (const [value, count] of source) {
    const found = translation.get(value) ?? 0
    for (let index = found; index < count; index++) missing.push(value)
  }
  return missing
}

function describeCharacters(characters: string[]): string {
  const counts = new Map<string, number>()
  for (const character of characters) {
    const code = `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  return [...counts].map(([code, count]) => count > 1 ? `${code} ×${count}` : code).join(', ')
}

export function translationQaIssues(source: string, translation: string, profileId: TokenProfileId = 'generic'): QaIssue[] {
  if (!translation.trim()) return []
  const issues: QaIssue[] = []
  const sourceTokens = extractProtectedTokens(source, profileId)
  const translationTokens = extractProtectedTokens(translation, profileId)
  const sourceText = blankTokens(source, sourceTokens)
  const translationText = blankTokens(translation, translationTokens)

  const invisible = [...translation.matchAll(INVISIBLE_CHARACTERS)].map((match) => match[0])
  if (invisible.length > 0) {
    const detail = describeCharacters(invisible)
    issues.push({ kind: 'invisible-characters', severity: 'warning', detail, message: `Invisible direction or zero-width characters in the translation: ${detail}` })
  }
  if (translation.includes(REPLACEMENT_CHARACTER)) {
    issues.push({ kind: 'replacement-character', severity: 'error', message: 'The translation contains a replacement character (U+FFFD): the text is corrupted.' })
  }

  // A line break is structure the game may render, so losing it is worth a look.
  const sourceHasNewline = /\r?\n/u.test(source)
  const translationHasNewline = /\r?\n/u.test(translation)
  if (sourceHasNewline && !translationHasNewline) {
    issues.push({ kind: 'newline-dropped', severity: 'warning', message: 'The source has line breaks the translation lost.' })
  } else if (!sourceHasNewline && translationHasNewline) {
    issues.push({ kind: 'newline-added', severity: 'warning', message: 'The translation adds line breaks the source does not have.' })
  }

  const sourceEdge = edgeWhitespace(source, sourceTokens)
  const translationEdge = edgeWhitespace(translation, translationTokens)
  for (const side of ['leading', 'trailing'] as const) {
    if (sourceEdge[side] === null || translationEdge[side] === null) continue
    const sourceHas = sourceEdge[side] !== ''
    const translationHas = translationEdge[side] !== ''
    if (sourceHas === translationHas) continue
    if (sourceHas) {
      issues.push({ kind: 'edge-space-dropped', severity: 'warning', detail: side, message: `The ${side} space of the source is missing from the translation.` })
    } else {
      issues.push({ kind: 'edge-space-added', severity: 'warning', detail: side, message: `The translation adds a ${side} space the source does not have.` })
    }
  }

  // Only a mark the source had and the translation lost is reported: choosing a
  // different mark, or adding one, is a translator's decision.
  const sourceMark = sourceText.trimEnd().slice(-1)
  const translationMark = translationText.trimEnd().slice(-1)
  if (TERMINAL_PUNCTUATION.has(sourceMark) && !TERMINAL_PUNCTUATION.has(translationMark)) {
    issues.push({ kind: 'terminal-punctuation-dropped', severity: 'warning', detail: sourceMark, message: `The source ends with "${sourceMark}"; the translation has no terminal punctuation.` })
  }

  const sourceNumbers = numberCounts(sourceText)
  const translationNumbers = numberCounts(translationText)
  const dropped = missingValues(sourceNumbers, translationNumbers)
  if (dropped.length > 0) {
    issues.push({ kind: 'number-dropped', severity: 'warning', detail: dropped.join(', '), message: `Source numbers missing from the translation: ${dropped.join(', ')}` })
  }
  // Extra numbers are only judged when the source had bare numbers to compare
  // against; placeholder-only sources legitimately render numbers at runtime.
  const added = sourceNumbers.size > 0 ? missingValues(translationNumbers, sourceNumbers) : []
  if (added.length > 0) {
    issues.push({ kind: 'number-added', severity: 'warning', detail: added.join(', '), message: `Numbers in the translation that are not in the source: ${added.join(', ')}` })
  }

  const sourceEntities = entityCounts(sourceText)
  const translationEntities = entityCounts(translationText)
  const entityDiff = [...new Set([...sourceEntities.keys(), ...translationEntities.keys()])].filter((name) => (sourceEntities.get(name) ?? 0) !== (translationEntities.get(name) ?? 0)).sort()
  if (entityDiff.length > 0) {
    const detail = entityDiff.map((name) => `${name} ${(sourceEntities.get(name) ?? 0) > (translationEntities.get(name) ?? 0) ? 'missing' : 'extra'}`).join(', ')
    issues.push({ kind: 'entity-mismatch', severity: 'warning', detail, message: `Markup entities differ from the source: ${detail}` })
  }

  return issues
}

/**
 * One translation reused for a different source. The same source twice is not a
 * finding (a repeated key is a project decision), so a group only counts when
 * at least two distinct sources share the translation.
 */
export function duplicateTranslationIds(entries: Array<{ id: string; source?: string; translation?: string }>): Map<string, string> {
  const groups = new Map<string, Array<{ id: string; source: string }>>()
  for (const entry of entries) {
    const translation = (entry.translation ?? '').trim().normalize('NFC')
    if (!translation) continue
    const group = groups.get(translation) ?? []
    group.push({ id: entry.id, source: (entry.source ?? '').trim() })
    groups.set(translation, group)
  }
  const duplicates = new Map<string, string>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    if (new Set(group.map((item) => item.source)).size < 2) continue
    for (const item of group) {
      const other = group.find((candidate) => candidate.id !== item.id && candidate.source !== item.source)
      if (other) duplicates.set(item.id, other.source.slice(0, 80))
    }
  }
  return duplicates
}

export function duplicateTranslationIssue(otherSource: string): QaIssue {
  return { kind: 'duplicate-translation', severity: 'warning', detail: otherSource, message: `The same translation is also used for another source: ${otherSource}` }
}
