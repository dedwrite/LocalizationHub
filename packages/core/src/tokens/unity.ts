import {
  extractGenericTokens,
} from './generic'

import type {
  ProtectedToken,
  TokenKind,
  TokenProfile,
  TokenRule,
} from './types'
import { scanBalancedBraces } from './scanners'

/*
 * Unity specific protected-content rules layered over the generic profile.
 *
 * Smart Strings use `{Placeholder}`, `{0}`, and nested selectors such as
 * `{Count:plural:one=item|other=items}` or `{Gender:choose:M|F:...}`. The
 * generic brace-variable rule already protects the simple `{Placeholder}` form;
 * these rules protect the nested selector/format machinery so translators edit
 * language content, not the Smart String mechanics.
 */

const UNITY_RULES: TokenRule[] = [
  {
    id: 'unity-smart-selector',
    kind: 'format',
    // Nested Smart String selector: {0:plural:...|...} / {Name:choose:...}
    pattern: /\{[^{}\r\n]*:(?:plural|select|choose|list|formatter)[^{}\r\n]*\}/g,
  },

  {
    id: 'unity-empty-placeholder',
    kind: 'variable',
    // Empty Smart String placeholder: {}
    pattern: /\{\}/g,
  },

  {
    id: 'unity-tmp-sprite-tag',
    kind: 'self-closing-tag',
    // TextMeshPro sprite tag: <sprite=0> / <sprite name="...">
    pattern: /<sprite\s*=[^<>\r\n]*?>/gi,
  },

  {
    id: 'unity-tmp-align-tag',
    kind: 'self-closing-tag',
    // TextMeshPro alignment/format tags that carry no text content.
    pattern: /<(?:align|allcaps|uppercase|lowercase|smallcaps|nobr|color|size|i|b|u|s|sub|sup|indent|line-height|space|voffset|page|font|material|style|width|pos|rotate|link|mspace|cspace|mark|alpha|gradient|gradient-1)[^<>\r\n]*?\/?>/gi,
  },
]

type CandidateToken = ProtectedToken & { priority: number }

function createToken(raw: string, start: number, kind: TokenKind, ruleId: string): ProtectedToken {
  return { raw, kind, start, end: start + raw.length, ruleId }
}

function overlaps(first: ProtectedToken, second: ProtectedToken): boolean {
  return first.start < second.end && second.start < first.end
}

function extractUnitySpecificTokens(text: string): ProtectedToken[] {
  const tokens: ProtectedToken[] = scanBalancedBraces(text, 'unity-smart-string', 'format')
    .filter((item) => /:/u.test(item.raw))
  for (const rule of UNITY_RULES) {
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

function mergeTokens(unityTokens: ProtectedToken[], genericTokens: ProtectedToken[]): ProtectedToken[] {
  const candidates: CandidateToken[] = [
    ...unityTokens.map((token) => ({ ...token, priority: 0 })),
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

export function extractUnityTokens(text: string): ProtectedToken[] {
  return mergeTokens(
    extractUnitySpecificTokens(text),
    extractGenericTokens(text),
  )
}

export const unityTokenProfile: TokenProfile = {
  id: 'unity',
  label: 'Unity',
  description:
    'Protection for Unity Smart String placeholders and nested selectors, TextMeshPro rich-text and sprite tags, and common localization tokens.',
  extract: extractUnityTokens,
}
