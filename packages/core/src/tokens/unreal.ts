import {
  extractGenericTokens,
} from './generic'

import type {
  ProtectedToken,
  TokenKind,
  TokenProfile,
  TokenRule,
} from './types'

/*
 * Unreal Engine specific protected-content rules layered over the generic
 * profile. FText format arguments (`{ArgName}`, `{0}`) are already covered by
 * the generic brace-variable rule; these rules protect the richer FText
 * plural/gender/Hangul modifiers and the empty inline rich-text closing tag.
 */

const UNREAL_RULES: TokenRule[] = [
  {
    id: 'unreal-empty-inline-close',
    kind: 'closing-tag',
    // Inline rich-text closing tag: <bold>text</>
    pattern: /<\/>/g,
  },

  {
    id: 'unreal-plural-selector',
    kind: 'format',
    // FText plural modifier: {Count}|plural(one=item,other=items)
    pattern: /\{[A-Za-z0-9_.-]+\}\|(?:plural|gender|hpp)\([^()\r\n]*\)/g,
  },

  {
    id: 'unreal-hangul-postposition',
    kind: 'format',
    // Hangul post-position modifier: {Word}(이)가 / {Word}를 / {Word}은
    pattern: /\{[A-Za-z0-9_.-]+\}\([^)\r\n]*\)/g,
  },

  {
    id: 'unreal-string-table-reference',
    kind: 'variable',
    // LOCTABLE references and string-table IDs: LOCTABLE("namespace","key")
    pattern: /LOCTABLE\([^)\r\n]*\)/gi,
  },
]

type CandidateToken = ProtectedToken & { priority: number }

function createToken(raw: string, start: number, kind: TokenKind, ruleId: string): ProtectedToken {
  return { raw, kind, start, end: start + raw.length, ruleId }
}

function overlaps(first: ProtectedToken, second: ProtectedToken): boolean {
  return first.start < second.end && second.start < first.end
}

function extractUnrealSpecificTokens(text: string): ProtectedToken[] {
  const tokens: ProtectedToken[] = []
  for (const rule of UNREAL_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0]
      if (!raw) { regex.lastIndex += 1; continue }
      tokens.push(createToken(raw, match.index, rule.kind, rule.id))
    }
  }
  return tokens
}

function mergeTokens(unrealTokens: ProtectedToken[], genericTokens: ProtectedToken[]): ProtectedToken[] {
  const candidates: CandidateToken[] = [
    ...unrealTokens.map((token) => ({ ...token, priority: 0 })),
    ...genericTokens.map((token) => ({ ...token, priority: 1 })),
  ]

  candidates.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    const lengthDifference = b.raw.length - a.raw.length
    if (lengthDifference !== 0) return lengthDifference
    return a.priority - b.priority
  })

  const accepted: ProtectedToken[] = []
  for (const candidate of candidates) {
    const hasOverlap = accepted.some((token) => overlaps(token, candidate))
    if (!hasOverlap) {
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

export function extractUnrealTokens(text: string): ProtectedToken[] {
  return mergeTokens(
    extractUnrealSpecificTokens(text),
    extractGenericTokens(text),
  )
}

export const unrealTokenProfile: TokenProfile = {
  id: 'unreal',
  label: 'Unreal',
  description:
    'Protection for Unreal Engine FText format arguments, plural/gender/Hangul modifiers, inline rich-text tags, string-table references, and common localization tokens.',
  extract: extractUnrealTokens,
}
