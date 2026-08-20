import {
  extractGenericTokens,
} from './generic'

import type {
  ProtectedToken,
  TokenKind,
  TokenProfile,
  TokenRule,
} from './types'

const GODOT_RULES:
  TokenRule[] = [
    {
      id:
        'godot-engine-command-line',

      kind:
        'control-code',

      pattern:
        /^[ \t]*(?:\$|::|->)[^\r\n]*$/gm,
    },

    {
      id:
        'godot-inline-dollar-command',

      kind:
        'control-code',

      pattern:
        /\[\$[^\]\r\n]*\]/g,
    },

    {
      id:
        'godot-format-placeholder',

      kind:
        'format',

      pattern:
        /%(?!%)[+\-]?(?:0?(?:\d+|\*))?(?:\.(?:\d*|\*))?[scdoxXfv]/g,
    },

    {
      id:
        'godot-percent-reference',

      kind:
        'variable',

      pattern:
        /(?<![\p{L}\p{N}])%[A-Za-z_][A-Za-z0-9_]*/gu,
    },

    {
      id:
        'godot-escaped-percent',

      kind:
        'escape',

      pattern:
        /%%/g,
    },

    {
      id:
        'godot-empty-brace-placeholder',

      kind:
        'variable',

      pattern:
        /\{\}/g,
    },

    {
      id:
        'godot-punctuation-control-marker',

      kind:
        'control-code',

      pattern:
        /\[[^\p{L}\p{N}\[\]\r\n]+\]/gu,
    },
  ]

type CandidateToken =
  ProtectedToken & {
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
    end:
      start + raw.length,
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

/*
 * يمنع false positives مثل:
 *
 * 100%discount
 *
 * لأن Generic/Godot قد يرى "%d"
 * في بداية كلمة "discount".
 *
 * لكن:
 *
 * Count: %d
 * Value: %s
 * Health: %d%%
 *
 * تبقى سليمة.
 */
function isPercentageWordFalsePositive(
  text: string,
  token: ProtectedToken,
): boolean {
  if (
    token.kind !== 'format' ||
    !token.raw.startsWith('%')
  ) {
    return false
  }

  const before =
    token.start > 0
      ? text[
          token.start - 1
        ]
      : ''

  const after =
    token.end < text.length
      ? text[token.end]
      : ''

  const precededByDigit =
    /\d/.test(before)

  const followedByWordCharacter =
    /[\p{L}\p{N}_]/u.test(
      after,
    )

  return (
    precededByDigit &&
    followedByWordCharacter
  )
}

function extractGodotSpecificTokens(
  text: string,
): ProtectedToken[] {
  const tokens:
    ProtectedToken[] = []

  for (
    const rule
    of GODOT_RULES
  ) {
    const regex =
      new RegExp(
        rule.pattern.source,
        rule.pattern.flags,
      )

    let match:
      RegExpExecArray | null

    while (
      (
        match =
          regex.exec(text)
      ) !== null
    ) {
      const raw =
        match[0]

      if (!raw) {
        regex.lastIndex += 1
        continue
      }

      const token =
        createToken(
          raw,
          match.index,
          rule.kind,
          rule.id,
        )

      if (
        isPercentageWordFalsePositive(
          text,
          token,
        )
      ) {
        continue
      }

      tokens.push(token)
    }
  }

  return tokens
}

function mergeTokens(
  text: string,
  godotTokens:
    ProtectedToken[],
  genericTokens:
    ProtectedToken[],
): ProtectedToken[] {
  const candidates:
    CandidateToken[] = [
      ...godotTokens.map(
        (token) => ({
          ...token,
          priority: 0,
        }),
      ),

      ...genericTokens.map(
        (token) => ({
          ...token,
          priority: 1,
        }),
      ),
    ]

  candidates.sort(
    (first, second) => {
      if (
        first.start !==
        second.start
      ) {
        return (
          first.start -
          second.start
        )
      }

      const lengthDifference =
        second.raw.length -
        first.raw.length

      if (
        lengthDifference !== 0
      ) {
        return lengthDifference
      }

      return (
        first.priority -
        second.priority
      )
    },
  )

  const accepted:
    ProtectedToken[] = []

  for (
    const candidate
    of candidates
  ) {
    /*
     * Generic profile قد يكون هو
     * الذي التقط %d داخل:
     *
     * 100%discount
     *
     * لذلك نعيد نفس الفحص بعد الدمج.
     */
    if (
      isPercentageWordFalsePositive(
        text,
        candidate,
      )
    ) {
      continue
    }

    const hasOverlap =
      accepted.some(
        (token) =>
          overlaps(
            token,
            candidate,
          ),
      )

    if (hasOverlap) {
      continue
    }

    accepted.push({
      raw:
        candidate.raw,

      kind:
        candidate.kind,

      start:
        candidate.start,

      end:
        candidate.end,

      ruleId:
        candidate.ruleId,
    })
  }

  return accepted.sort(
    (first, second) =>
      first.start -
      second.start,
  )
}

export function extractGodotTokens(
  text: string,
): ProtectedToken[] {
  const godotTokens =
    extractGodotSpecificTokens(
      text,
    )

  const genericTokens =
    extractGenericTokens(
      text,
    )

  return mergeTokens(
    text,
    godotTokens,
    genericTokens,
  )
}

export const godotTokenProfile:
  TokenProfile = {
    id:
      'godot',

    label:
      'Godot',

    description:
      'Protection for Godot and project localization markup, engine command lines, inline commands, percent references, format strings, BBCode, control markers, escaped percent signs, and common localization tokens.',

    extract:
      extractGodotTokens,
  }