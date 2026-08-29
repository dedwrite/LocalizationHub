import type { ProtectedToken, TokenKind } from './types'

function token(raw: string, start: number, kind: TokenKind, ruleId: string): ProtectedToken {
  return { raw, start, end: start + raw.length, kind, ruleId }
}

/**
 * Scans balanced brace expressions without regex backtracking. Escaped braces
 * and malformed/unclosed expressions are left as ordinary text.
 */
export function scanBalancedBraces(text: string, ruleId: string, kind: TokenKind = 'format'): ProtectedToken[] {
  const result: ProtectedToken[] = []
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '{' || text[i - 1] === '\\') continue
    let depth = 1
    let quote: string | null = null
    for (let j = i + 1; j < text.length; j += 1) {
      const char = text[j]
      if (quote) {
        if (char === quote && text[j - 1] !== '\\') quote = null
        continue
      }
      if (char === '"' || char === "'") {
        quote = char
        continue
      }
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      if (depth === 0) {
        const raw = text.slice(i, j + 1)
        if (raw.length > 2 && /[^{}\r\n]/u.test(raw.slice(1, -1))) result.push(token(raw, i, kind, ruleId))
        i = j
        break
      }
    }
  }
  return result
}

/** Scan a balanced parenthesized modifier beginning at `start`. */
export function scanBalancedParentheses(text: string, start: number): number {
  if (text[start] !== '(') return -1
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < text.length; i += 1) {
    const char = text[i]
    if (quote) {
      if (char === quote && text[i - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(') depth += 1
    if (char === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

