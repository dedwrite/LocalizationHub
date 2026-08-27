/*
 * Custom protected-token patterns.
 *
 * Users can extend the built-in token profiles with their own protected
 * patterns (regex + label). Each pattern is compiled into a `TokenRule` so it
 * participates in the same extraction/validation pipeline as the built-ins:
 *
 *   - validation rejects invalid or degenerate regexes up front
 *   - extraction sorts matches by position and de-duplicates overlaps
 *   - the resulting profile is registered under the `custom` profile id
 *
 * The user-supplied regex is a *source string* (not a `RegExp` literal), which
 * is what the UI persists. We never `eval` user input; `new RegExp` is the
 * only compilation path.
 */

import type {
  ProtectedToken,
  TokenKind,
  TokenProfile,
  TokenRule,
} from './types'

export type CustomPattern = {
  id: string
  label: string
  /*
   * Regex source string. Flags are intentionally NOT accepted here: patterns
   * are always compiled with the `g` flag so a full scan is performed, and
   * the `u` flag so Unicode text matches correctly. This keeps behavior
   * deterministic and avoids stateful (`y`) or lastIndex surprises.
   */
  pattern: string
}

export type CustomPatternValidation =
  | { valid: true }
  | { valid: false; error: string }

export type CustomPatternPreview = {
  valid: boolean
  error?: string
  matches: Array<{ raw: string; start: number; end: number }>
}

const MAX_PATTERN_LENGTH = 512
const MAX_CUSTOM_PATTERNS = 100

function tryCompile(pattern: string): { regex?: RegExp; error?: string } {
  const trimmed = pattern.trim()
  if (!trimmed) {
    return { error: 'Pattern is empty.' }
  }
  if (trimmed.length > MAX_PATTERN_LENGTH) {
    return { error: `Pattern exceeds ${MAX_PATTERN_LENGTH} characters.` }
  }
  try {
    const regex = new RegExp(trimmed, 'gu')
    return { regex }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Invalid regular expression.',
    }
  }
}

/*
 * Validate a single pattern source string without executing it.
 */
export function validateCustomPattern(pattern: string): CustomPatternValidation {
  const result = tryCompile(pattern)
  if (result.error) return { valid: false, error: result.error }
  return { valid: true }
}

/*
 * Preview matches against a sample string. Also validates the pattern.
 */
export function previewCustomPattern(
  pattern: string,
  sample: string,
): CustomPatternPreview {
  const result = tryCompile(pattern)
  if (result.error) {
    return { valid: false, error: result.error, matches: [] }
  }

  const regex = result.regex as RegExp
  const matches: CustomPatternPreview['matches'] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(sample)) !== null) {
    if (!match[0]) {
      regex.lastIndex += 1
      continue
    }
    matches.push({ raw: match[0], start: match.index, end: match.index + match[0].length })
  }

  return { valid: true, matches }
}

function createToken(raw: string, start: number, kind: TokenKind, ruleId: string): ProtectedToken {
  return { raw, kind, start, end: start + raw.length, ruleId }
}

function overlaps(first: ProtectedToken, second: ProtectedToken): boolean {
  return first.start < second.end && second.start < first.end
}

/*
 * Build a TokenProfile from user patterns. Invalid patterns are rejected; the
 * caller should validate before persisting, but this is a second line of
 * defense so a corrupt stored pattern can never break the scan.
 */
export function createCustomTokenProfile(patterns: CustomPattern[]): TokenProfile {
  const rules: TokenRule[] = []

  for (const pattern of patterns.slice(0, MAX_CUSTOM_PATTERNS)) {
    const compiled = tryCompile(pattern.pattern)
    if (compiled.error || !compiled.regex) continue
    rules.push({
      id: `custom-${pattern.id}`,
      kind: 'variable',
      pattern: compiled.regex,
    })
  }

  const extract = (text: string): ProtectedToken[] => {
    const candidates: Array<ProtectedToken & { priority: number }> = []

    rules.forEach((rule, priority) => {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
      let match: RegExpExecArray | null
      while ((match = regex.exec(text)) !== null) {
        const raw = match[0]
        if (!raw) {
          regex.lastIndex += 1
          continue
        }
        candidates.push({ ...createToken(raw, match.index, rule.kind, rule.id), priority })
      }
    })

    candidates.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      if (a.priority !== b.priority) return a.priority - b.priority
      return b.raw.length - a.raw.length
    })

    const accepted: ProtectedToken[] = []
    for (const candidate of candidates) {
      if (!accepted.some((token) => overlaps(token, candidate))) {
        accepted.push({
          raw: candidate.raw,
          kind: candidate.kind,
          start: candidate.start,
          end: candidate.end,
          ruleId: candidate.ruleId,
        })
      }
    }

    return accepted.sort((a, b) => a.start - b.start)
  }

  return {
    id: 'custom',
    label: 'Custom',
    description: 'User-defined protected patterns.',
    extract,
  }
}
