import { genericTokenProfile } from './generic'

import type {
  ProtectedToken,
  TokenProfile,
  TokenProfileId,
  TokenValidationResult,
} from './types'

export type {
  ProtectedToken,
  TokenKind,
  TokenProfile,
  TokenProfileId,
  TokenValidationResult,
} from './types'

const tokenProfiles: Record<
  TokenProfileId,
  TokenProfile | undefined
> = {
  generic: genericTokenProfile,
  godot: undefined,
  unity: undefined,
  unreal: undefined,
  renpy: undefined,
  custom: undefined,
}

export function getTokenProfile(
  profileId: TokenProfileId = 'generic',
): TokenProfile {
  return (
    tokenProfiles[profileId] ??
    genericTokenProfile
  )
}

export function extractProtectedTokens(
  text: string,
  profileId: TokenProfileId = 'generic',
): ProtectedToken[] {
  return getTokenProfile(profileId).extract(text)
}

function groupTokensByValue(
  tokens: ProtectedToken[],
): Map<string, ProtectedToken[]> {
  const groups = new Map<
    string,
    ProtectedToken[]
  >()

  for (const token of tokens) {
    const current = groups.get(token.raw) ?? []

    current.push(token)
    groups.set(token.raw, current)
  }

  return groups
}

function getRelativePosition(
  token: ProtectedToken,
  text: string,
): number {
  const usableLength = Math.max(
    1,
    text.length - token.raw.length,
  )

  return token.start / usableLength
}

function shouldCheckPosition(
  token: ProtectedToken,
): boolean {
  return (
    token.kind === 'variable' ||
    token.kind === 'format' ||
    token.kind === 'escape' ||
    token.kind === 'control-code' ||
    token.kind === 'self-closing-tag'
  )
}

function detectMisplacedTokens(
  source: string,
  translation: string,
  sourceGroups: Map<string, ProtectedToken[]>,
  translationGroups: Map<string, ProtectedToken[]>,
): ProtectedToken[] {
  const misplaced: ProtectedToken[] = []

  for (const [raw, sourceTokens] of sourceGroups) {
    const translatedTokens =
      translationGroups.get(raw) ?? []

    const comparableCount = Math.min(
      sourceTokens.length,
      translatedTokens.length,
    )

    for (
      let index = 0;
      index < comparableCount;
      index += 1
    ) {
      const sourceToken = sourceTokens[index]
      const translatedToken =
        translatedTokens[index]

      if (!shouldCheckPosition(sourceToken)) {
        continue
      }

      const sourcePosition =
        getRelativePosition(
          sourceToken,
          source,
        )

      const translationPosition =
        getRelativePosition(
          translatedToken,
          translation,
        )

      const movement = Math.abs(
        sourcePosition -
        translationPosition,
      )

      /*
       * 0.35 = سماح معقول لتغيّر ترتيب الجملة
       * بين اللغات.
       *
       * إذا انتقل التوكن من بداية النص
       * إلى نهايته مثلاً، نعتبره مشبوهاً.
       */
      if (movement > 0.35) {
        misplaced.push(
          sourceToken,
        )
      }
    }
  }

  return misplaced
}

function detectOrderMismatch(
  sourceTokens: ProtectedToken[],
  translationTokens: ProtectedToken[],
): boolean {
  if (
    sourceTokens.length === 0 ||
    sourceTokens.length !==
      translationTokens.length
  ) {
    return false
  }

  const sourceOrder =
    sourceTokens.map(
      (token) => token.raw,
    )

  const translationOrder =
    translationTokens.map(
      (token) => token.raw,
    )

  return sourceOrder.some(
    (token, index) =>
      token !==
      translationOrder[index],
  )
}

export function validateProtectedTokens(
  source: string,
  translation: string,
  profileId: TokenProfileId = 'generic',
): TokenValidationResult {
  const sourceTokens =
    extractProtectedTokens(
      source,
      profileId,
    )

  const translationTokens =
    extractProtectedTokens(
      translation,
      profileId,
    )

  const sourceGroups =
    groupTokensByValue(
      sourceTokens,
    )

  const translationGroups =
    groupTokensByValue(
      translationTokens,
    )

  const missingTokens: ProtectedToken[] = []
  const extraTokens: ProtectedToken[] = []

  for (
    const [raw, tokens]
    of sourceGroups
  ) {
    const translatedTokens =
      translationGroups.get(raw) ?? []

    const missingCount =
      tokens.length -
      translatedTokens.length

    if (missingCount > 0) {
      missingTokens.push(
        ...tokens.slice(
          0,
          missingCount,
        ),
      )
    }
  }

  for (
    const [raw, tokens]
    of translationGroups
  ) {
    const sourceMatches =
      sourceGroups.get(raw) ?? []

    const extraCount =
      tokens.length -
      sourceMatches.length

    if (extraCount > 0) {
      extraTokens.push(
        ...tokens.slice(
          0,
          extraCount,
        ),
      )
    }
  }

  const misplacedTokens =
    detectMisplacedTokens(
      source,
      translation,
      sourceGroups,
      translationGroups,
    )

  const orderMismatch =
    missingTokens.length === 0 &&
    extraTokens.length === 0 &&
    detectOrderMismatch(
      sourceTokens,
      translationTokens,
    )

  return {
    sourceTokens,
    translationTokens,

    missingTokens,
    extraTokens,
    misplacedTokens,

    orderMismatch,

    isValid:
      missingTokens.length === 0 &&
      extraTokens.length === 0 &&
      misplacedTokens.length === 0 &&
      !orderMismatch,
  }
}

export function hasProtectedTokens(
  text: string,
  profileId: TokenProfileId = 'generic',
): boolean {
  return (
    extractProtectedTokens(
      text,
      profileId,
    ).length > 0
  )
}