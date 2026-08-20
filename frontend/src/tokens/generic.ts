import type {
  ProtectedToken,
  TokenKind,
  TokenProfile,
  TokenRule,
} from './types'

const GENERIC_RULES: TokenRule[] = [
  {
    id: 'mustache-variable',
    kind: 'variable',
    pattern: /\{\{[^{}\r\n]+\}\}/g,
  },

  {
    id: 'template-variable',
    kind: 'variable',
    pattern: /\$\{[^{}\r\n]+\}/g,
  },

  {
    id: 'brace-variable',
    kind: 'variable',
    pattern: /\{[A-Za-z0-9_.:-]+\}/g,
  },

  {
    id: 'printf-positional',
    kind: 'format',
    pattern:
      /%(?:\d+\$)[-+#0 ']*\d*(?:\.\d+)?[diuoxXfFeEgGaAcspn]/g,
  },

  {
    id: 'printf-standard',
    kind: 'format',
    pattern:
      /%(?!%)[-+#0 ']*\d*(?:\.\d+)?[diuoxXfFeEgGaAcspn]/g,
  },

  {
    id: 'percent-variable',
    kind: 'variable',
    pattern: /%[A-Za-z_][A-Za-z0-9_]*%/g,
  },

  {
    id: 'escape-sequence',
    kind: 'escape',
    pattern: /\\(?:n|r|t|0|\\|"|')/g,
  },

  {
    id: 'html-closing-tag',
    kind: 'closing-tag',
    pattern: /<\/[A-Za-z][^<>\r\n]*?>/g,
  },

  {
    id: 'html-self-closing-tag',
    kind: 'self-closing-tag',
    pattern: /<[A-Za-z][^<>\r\n]*?\/>/g,
  },

  {
    id: 'html-opening-tag',
    kind: 'opening-tag',
    pattern: /<[A-Za-z][^<>\r\n]*?>/g,
  },

  {
    id: 'bbcode-closing-tag',
    kind: 'closing-tag',
    pattern: /\[\/[A-Za-z][^\[\]\r\n]*\]/g,
  },

  {
    id: 'bbcode-opening-tag',
    kind: 'opening-tag',
    pattern: /\[[A-Za-z][^\[\]\r\n]*\]/g,
  },
]

type CandidateToken = ProtectedToken & {
  priority: number
}

function createToken(
  raw: string,
  start: number,
  kind: TokenKind,
  ruleId: string,
): ProtectedToken {
  return {
    raw,
    kind,
    start,
    end: start + raw.length,
    ruleId,
  }
}

function overlaps(
  first: ProtectedToken,
  second: ProtectedToken,
): boolean {
  return (
    first.start < second.end &&
    second.start < first.end
  )
}

export function extractGenericTokens(
  text: string,
): ProtectedToken[] {
  const candidates: CandidateToken[] = []

  GENERIC_RULES.forEach((rule, priority) => {
    const regex = new RegExp(
      rule.pattern.source,
      rule.pattern.flags,
    )

    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const raw = match[0]

      if (!raw) {
        regex.lastIndex += 1
        continue
      }

      candidates.push({
        ...createToken(
          raw,
          match.index,
          rule.kind,
          rule.id,
        ),
        priority,
      })
    }
  })

  candidates.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start
    }

    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }

    return b.raw.length - a.raw.length
  })

  const accepted: ProtectedToken[] = []

  for (const candidate of candidates) {
    const hasOverlap = accepted.some((token) =>
      overlaps(token, candidate),
    )

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

export const genericTokenProfile: TokenProfile = {
  id: 'generic',
  label: 'Generic',
  description:
    'Generic protection for common variables, formatting tokens, tags, and escape sequences.',
  extract: extractGenericTokens,
}