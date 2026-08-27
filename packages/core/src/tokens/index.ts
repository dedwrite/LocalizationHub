import { genericTokenProfile } from './generic'
import { godotTokenProfile } from './godot'
import { unrealTokenProfile } from './unreal'
import { unityTokenProfile } from './unity'

import type {
  ProtectedToken,
  TokenProfile,
  TokenProfileId,
  TokenValidationIssue,
  TokenValidationResult,
} from './types'

export type {
  ProtectedToken,
  TokenKind,
  TokenProfile,
  TokenProfileId,
  TokenIssueKind,
  TokenIssueSeverity,
  TokenValidationIssue,
  TokenValidationResult,
} from './types'

export {
  createCustomTokenProfile,
  validateCustomPattern,
  previewCustomPattern,
  type CustomPattern,
  type CustomPatternValidation,
  type CustomPatternPreview,
} from './custom'

const tokenProfiles: Record<
  TokenProfileId,
  TokenProfile | undefined
> = {
  generic: genericTokenProfile,
  godot: godotTokenProfile,
  unreal: unrealTokenProfile,
  unity: unityTokenProfile,
  renpy: undefined,
  custom: undefined,
}

/*
 * The `custom` profile is user-defined and lives outside this module (e.g.
 * in the desktop/web UI). The registry holds the active custom profile so
 * that `getTokenProfile('custom')` resolves it; when unset it falls back to
 * the generic profile rather than failing.
 */
let customTokenProfile: TokenProfile | undefined

export function setCustomTokenProfile(profile: TokenProfile | undefined): void {
  customTokenProfile = profile
}

/*
 * Extract the tokens of the active custom profile (if any). Used by the
 * extraction pipeline so user-defined protected patterns are carried onto
 * extracted entries in addition to the engine's built-in tokens.
 */
export function extractCustomProtectedTokens(text: string): ProtectedToken[] {
  if (!customTokenProfile) return []
  return customTokenProfile.extract(text)
}

export function getTokenProfile(
  profileId: TokenProfileId = 'generic',
): TokenProfile {
  if (profileId === 'custom' && customTokenProfile) {
    return customTokenProfile
  }
  return (
    tokenProfiles[profileId] ??
    genericTokenProfile
  )
}

export function extractProtectedTokens(
  text: string,
  profileId: TokenProfileId = 'generic',
): ProtectedToken[] {
  return getTokenProfile(
    profileId,
  ).extract(text)
}

function groupTokensByValue(
  tokens: ProtectedToken[],
): Map<string, ProtectedToken[]> {
  const groups =
    new Map<string, ProtectedToken[]>()

  for (const token of tokens) {
    const current =
      groups.get(token.raw) ?? []

    current.push(token)

    groups.set(
      token.raw,
      current,
    )
  }

  return groups
}

function removeProtectedTokens(
  text: string,
  profileId: TokenProfileId,
): string {
  const tokens =
    extractProtectedTokens(
      text,
      profileId,
    )

  if (tokens.length === 0) {
    return text
  }

  let result = ''
  let cursor = 0

  for (const token of tokens) {
    result += text.slice(
      cursor,
      token.start,
    )

    cursor = token.end
  }

  result += text.slice(cursor)

  return result
}

/*
 * Ù†Ø³ØªØ®Ø¯Ù… Ø§Ù„Ø­Ø±ÙˆÙ ÙˆØ§Ù„Ø£Ø±Ù‚Ø§Ù… ÙÙ‚Ø·
 * Ù„ØªØ­Ø¯ÙŠØ¯ Ù…ÙˆÙ‚Ø¹ Ø§Ù„Ù€token.
 *
 * Ø¹Ù„Ø§Ù…Ø§Øª Ø§Ù„ØªØ±Ù‚ÙŠÙ… ÙˆØ§Ù„Ù…Ø³Ø§ÙØ§Øª Ù„Ø§ ØªØ¬Ø¹Ù„
 * Ø§Ù„Ù€token "ÙˆØ³Ø· Ø§Ù„Ù†Øµ" Ù„ÙˆØ­Ø¯Ù‡Ø§.
 */
function hasMeaningfulText(
  text: string,
  profileId: TokenProfileId,
): boolean {
  const withoutTokens =
    removeProtectedTokens(
      text,
      profileId,
    )

  return /[\p{L}\p{N}]/u.test(
    withoutTokens,
  )
}

/*
 * Ø¯Ø§Ø®Ù„ paired tags Ù†Ø¹ØªØ¨Ø± Ø£ÙŠ Ù…Ø­ØªÙˆÙ‰
 * ØºÙŠØ± ÙØ§Ø±Øº Ù…Ù‡Ù…Ù‹Ø§ØŒ ÙˆØ­ØªÙ‰ ÙˆØ¬ÙˆØ¯ token
 * Ø¢Ø®Ø± Ø¯Ø§Ø®Ù„ Ø§Ù„ÙˆØ³Ù… ÙŠØ¹ØªØ¨Ø± Ù…Ø­ØªÙˆÙ‰.
 */
function hasTagContent(
  text: string,
  profileId: TokenProfileId,
): boolean {
  if (
    removeProtectedTokens(
      text,
      profileId,
    ).trim().length > 0
  ) {
    return true
  }

  return (
    extractProtectedTokens(
      text,
      profileId,
    ).length > 0
  )
}

type TokenPlacement =
  | 'only'
  | 'leading'
  | 'middle'
  | 'trailing'

function getTokenPlacement(
  token: ProtectedToken,
  text: string,
  profileId: TokenProfileId,
): TokenPlacement {
  const before =
    text.slice(
      0,
      token.start,
    )

  const after =
    text.slice(
      token.end,
    )

  const hasBefore =
    hasMeaningfulText(
      before,
      profileId,
    )

  const hasAfter =
    hasMeaningfulText(
      after,
      profileId,
    )

  if (
    !hasBefore &&
    !hasAfter
  ) {
    return 'only'
  }

  if (
    !hasBefore &&
    hasAfter
  ) {
    return 'leading'
  }

  if (
    hasBefore &&
    !hasAfter
  ) {
    return 'trailing'
  }

  return 'middle'
}

function describeTokenPlacement(
  placement: TokenPlacement,
): string {
  switch (placement) {
    case 'only':
      return 'the only content'

    case 'leading':
      return 'the beginning of the text'

    case 'middle':
      return 'the middle of the text'

    case 'trailing':
      return 'the end of the text'
  }
}

/*
 * Generic placement warnings.
 *
 * Ù…Ù‡Ù…:
 * Ù„Ø§ Ù†ÙØ­Øµ opening/closing tags Ù‡Ù†Ø§.
 * paired tags Ù„Ù‡Ø§ Tag Scope Guard
 * Ù…Ø³ØªÙ‚Ù„ØŒ ÙˆØ¥Ù„Ø§ Ø³Ù†ÙƒØ±Ø± Ù†ÙØ³ Ø§Ù„ØªØ­Ø°ÙŠØ±
 * Ø¨Ø£ÙƒØ«Ø± Ù…Ù† Ø´ÙƒÙ„.
 */
function detectGenericPlacementIssues(
  source: string,
  translation: string,
  sourceGroups:
    Map<string, ProtectedToken[]>,
  translationGroups:
    Map<string, ProtectedToken[]>,
  profileId: TokenProfileId,
): TokenValidationIssue[] {
  const issues:
    TokenValidationIssue[] = []

  for (
    const [raw, sourceTokens]
    of sourceGroups
  ) {
    const translatedTokens =
      translationGroups.get(raw) ?? []

    const comparableCount =
      Math.min(
        sourceTokens.length,
        translatedTokens.length,
      )

    for (
      let index = 0;
      index < comparableCount;
      index += 1
    ) {
      const sourceToken =
        sourceTokens[index]

      const translatedToken =
        translatedTokens[index]

      /*
       * Paired tag placement is handled
       * by detectTagScopeIssues().
       */
      const isPairedTagToken =
        sourceToken.kind ===
          'opening-tag' ||
        sourceToken.kind ===
          'closing-tag'

      if (isPairedTagToken) {
        continue
      }

      const sourcePlacement =
        getTokenPlacement(
          sourceToken,
          source,
          profileId,
        )

      const translationPlacement =
        getTokenPlacement(
          translatedToken,
          translation,
          profileId,
        )

      if (
        sourcePlacement ===
        translationPlacement
      ) {
        continue
      }

      issues.push({
        kind:
          'token-placement-changed',

        severity:
          'warning',

        token:
          translatedToken,

        message:
          `${raw} is at ${describeTokenPlacement(sourcePlacement)} in the source, but at ${describeTokenPlacement(translationPlacement)} in the translation.`,
      })
    }
  }

  return issues
}

/*
 * Ø¥Ø¹Ø§Ø¯Ø© ØªØ±ØªÙŠØ¨ Ø§Ù„Ù€tokens Ù„ÙŠØ³Øª Ø¯Ø§Ø¦Ù…Ù‹Ø§
 * Ø®Ø·Ø£ØŒ Ø®ØµÙˆØµÙ‹Ø§ Ø¨ÙŠÙ† Ù„ØºØªÙŠÙ† Ø¨ØªØ±ÙƒÙŠØ¨ Ù…Ø®ØªÙ„Ù.
 *
 * Ù„Ø°Ù„Ùƒ Ù‡ÙŠ Warning ÙÙ‚Ø·.
 */
function detectTokenOrderIssues(
  sourceTokens:
    ProtectedToken[],
  translationTokens:
    ProtectedToken[],
  missingTokens:
    ProtectedToken[],
  extraTokens:
    ProtectedToken[],
): TokenValidationIssue[] {
  if (
    missingTokens.length > 0 ||
    extraTokens.length > 0 ||
    sourceTokens.length < 2 ||
    sourceTokens.length !==
      translationTokens.length
  ) {
    return []
  }

  const sourceOrder =
    sourceTokens.map(
      (token) => token.raw,
    )

  const translationOrder =
    translationTokens.map(
      (token) => token.raw,
    )

  const orderChanged =
    sourceOrder.some(
      (raw, index) =>
        raw !==
        translationOrder[index],
    )

  if (!orderChanged) {
    return []
  }

  return [
    {
      kind:
        'token-order-changed',

      severity:
        'warning',

      message:
        'Protected tokens appear in a different order than in the source text.',
    },
  ]
}

function getTagName(
  token: ProtectedToken,
): string | null {
  if (
    token.kind !==
      'opening-tag' &&
    token.kind !==
      'closing-tag'
  ) {
    return null
  }

  const raw =
    token.raw.trim()

  const htmlMatch =
    raw.match(
      /^<\s*\/?\s*([A-Za-z][\w:-]*)/,
    )

  if (htmlMatch) {
    return htmlMatch[1]
      .toLowerCase()
  }

  const bbcodeMatch =
    raw.match(
      /^\[\s*\/?\s*([A-Za-z][\w:-]*)/,
    )

  if (bbcodeMatch) {
    return bbcodeMatch[1]
      .toLowerCase()
  }

  return null
}

/*
 * Broken tag structure is a hard error.
 *
 * Examples:
 *
 * </color><color>
 *
 * <b><i>text</b></i>
 *
 * <color>text
 */
function detectTagStructureIssues(
  sourceTokens:
    ProtectedToken[],
  translationTokens:
    ProtectedToken[],
): TokenValidationIssue[] {
  const issues:
    TokenValidationIssue[] = []

  /*
   * Ù†ØªØ¹Ø§Ù…Ù„ ÙÙ‚Ø· Ù…Ø¹ Ø£Ø³Ù…Ø§Ø¡ tags
   * Ø§Ù„Ù…ÙˆØ¬ÙˆØ¯Ø© ÙƒØ£Ø²ÙˆØ§Ø¬ ÙØ¹Ù„ÙŠØ© ÙÙŠ Ø§Ù„Ù…ØµØ¯Ø±.
   */
  const pairableNames =
    new Set<string>()

  for (const token of sourceTokens) {
    if (
      token.kind !==
      'closing-tag'
    ) {
      continue
    }

    const name =
      getTagName(token)

    if (name) {
      pairableNames.add(name)
    }
  }

  if (
    pairableNames.size === 0
  ) {
    return issues
  }

  const stack: string[] = []

  for (
    const token
    of translationTokens
  ) {
    const name =
      getTagName(token)

    if (
      !name ||
      !pairableNames.has(name)
    ) {
      continue
    }

    if (
      token.kind ===
      'opening-tag'
    ) {
      stack.push(name)
      continue
    }

    if (
      token.kind !==
      'closing-tag'
    ) {
      continue
    }

    const expected =
      stack[
        stack.length - 1
      ]

    if (!expected) {
      issues.push({
        kind:
          'tag-structure-invalid',

        severity:
          'error',

        token,

        message:
          `Closing tag ${token.raw} appears without a matching opening tag.`,
      })

      continue
    }

    if (expected !== name) {
      issues.push({
        kind:
          'tag-structure-invalid',

        severity:
          'error',

        token,

        message:
          `Tag structure is invalid near ${token.raw}. Expected a closing tag for ${expected}.`,
      })

      continue
    }

    stack.pop()
  }

  for (const name of stack) {
    issues.push({
      kind:
        'tag-structure-invalid',

      severity:
        'error',

      message:
        `Protected tag ${name} was opened but never closed.`,
    })
  }

  return issues
}

type PairedTag = {
  name: string
  opening: ProtectedToken
  closing: ProtectedToken
  content: string
}

function collectPairedTags(
  text: string,
  tokens: ProtectedToken[],
): PairedTag[] {
  const pairs:
    PairedTag[] = []

  const stack: {
    name: string
    token: ProtectedToken
  }[] = []

  for (const token of tokens) {
    const name =
      getTagName(token)

    if (!name) {
      continue
    }

    if (
      token.kind ===
      'opening-tag'
    ) {
      stack.push({
        name,
        token,
      })

      continue
    }

    if (
      token.kind !==
      'closing-tag'
    ) {
      continue
    }

    const top =
      stack[
        stack.length - 1
      ]

    if (
      !top ||
      top.name !== name
    ) {
      continue
    }

    stack.pop()

    pairs.push({
      name,

      opening:
        top.token,

      closing:
        token,

      content:
        text.slice(
          top.token.end,
          token.start,
        ),
    })
  }

  return pairs
}

function groupPairsByName(
  pairs: PairedTag[],
): Map<string, PairedTag[]> {
  const groups =
    new Map<string, PairedTag[]>()

  for (const pair of pairs) {
    const current =
      groups.get(
        pair.name,
      ) ?? []

    current.push(pair)

    groups.set(
      pair.name,
      current,
    )
  }

  return groups
}

/*
 * Ø¥Ø°Ø§ Ø§Ù„ÙˆØ³Ù… ÙÙŠ Ø§Ù„Ù…ØµØ¯Ø± ÙŠØ­ØªÙˆÙŠ Ù…Ø­ØªÙˆÙ‰ØŒ
 * Ø«Ù… ØµØ§Ø± ÙØ§Ø±ØºÙ‹Ø§ ÙÙŠ Ø§Ù„ØªØ±Ø¬Ù…Ø©:
 *
 * [em1]text[/em1]
 *
 * Ø¥Ù„Ù‰:
 *
 * [em1][/em1]
 *
 * ÙÙ‡Ø°Ø§ Hard Error.
 */
function detectTagContentIssues(
  source: string,
  translation: string,
  sourceTokens:
    ProtectedToken[],
  translationTokens:
    ProtectedToken[],
  profileId: TokenProfileId,
): TokenValidationIssue[] {
  const issues:
    TokenValidationIssue[] = []

  const sourcePairs =
    groupPairsByName(
      collectPairedTags(
        source,
        sourceTokens,
      ),
    )

  const translationPairs =
    groupPairsByName(
      collectPairedTags(
        translation,
        translationTokens,
      ),
    )

  for (
    const [name, sourceTags]
    of sourcePairs
  ) {
    const translatedTags =
      translationPairs.get(
        name,
      ) ?? []

    const comparableCount =
      Math.min(
        sourceTags.length,
        translatedTags.length,
      )

    for (
      let index = 0;
      index < comparableCount;
      index += 1
    ) {
      const sourcePair =
        sourceTags[index]

      const translatedPair =
        translatedTags[index]

      const sourceContainsContent =
        hasTagContent(
          sourcePair.content,
          profileId,
        )

      const translationContainsContent =
        hasTagContent(
          translatedPair.content,
          profileId,
        )

      if (
        sourceContainsContent &&
        !translationContainsContent
      ) {
        issues.push({
          kind:
            'tag-content-empty',

          severity:
            'error',

          token:
            translatedPair.opening,

          message:
            `${translatedPair.opening.raw}${translatedPair.closing.raw} became empty, but the matching source tag contains content.`,
        })
      }
    }
  }

  return issues
}

type TagScopeShape =
  | 'entire'
  | 'prefix'
  | 'middle'
  | 'suffix'

function getTagScopeShape(
  text: string,
  pair: PairedTag,
  profileId: TokenProfileId,
): TagScopeShape {
  const before =
    text.slice(
      0,
      pair.opening.start,
    )

  const after =
    text.slice(
      pair.closing.end,
    )

  const hasBefore =
    hasMeaningfulText(
      before,
      profileId,
    )

  const hasAfter =
    hasMeaningfulText(
      after,
      profileId,
    )

  if (
    !hasBefore &&
    !hasAfter
  ) {
    return 'entire'
  }

  if (
    !hasBefore &&
    hasAfter
  ) {
    return 'prefix'
  }

  if (
    hasBefore &&
    !hasAfter
  ) {
    return 'suffix'
  }

  return 'middle'
}

function describeTagScope(
  scope: TagScopeShape,
): string {
  switch (scope) {
    case 'entire':
      return 'the entire text'

    case 'prefix':
      return 'the beginning of the text'

    case 'middle':
      return 'a middle section of the text'

    case 'suffix':
      return 'the end of the text'
  }
}

/*
 * ØªØºÙŠØ± Ù†Ø·Ø§Ù‚ Ø§Ù„ÙˆØ³Ù… Ù„ÙŠØ³ Ø¯Ø§Ø¦Ù…Ù‹Ø§
 * Ø®Ø·Ø£ Ù…Ø¤ÙƒØ¯.
 *
 * ØªØ±ØªÙŠØ¨ Ø§Ù„Ø¬Ù…Ù„Ø© Ù‚Ø¯ ÙŠØªØºÙŠØ± Ø¨ÙŠÙ†
 * Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ© ÙˆØ§Ù„Ø¹Ø±Ø¨ÙŠØ©.
 *
 * Ù„Ø°Ù„Ùƒ Tag Scope = Warning.
 */
function detectTagScopeIssues(
  source: string,
  translation: string,
  sourceTokens:
    ProtectedToken[],
  translationTokens:
    ProtectedToken[],
  profileId: TokenProfileId,
): TokenValidationIssue[] {
  const issues:
    TokenValidationIssue[] = []

  const sourcePairs =
    groupPairsByName(
      collectPairedTags(
        source,
        sourceTokens,
      ),
    )

  const translationPairs =
    groupPairsByName(
      collectPairedTags(
        translation,
        translationTokens,
      ),
    )

  for (
    const [name, sourceTags]
    of sourcePairs
  ) {
    const translatedTags =
      translationPairs.get(
        name,
      ) ?? []

    const comparableCount =
      Math.min(
        sourceTags.length,
        translatedTags.length,
      )

    for (
      let index = 0;
      index < comparableCount;
      index += 1
    ) {
      const sourcePair =
        sourceTags[index]

      const translatedPair =
        translatedTags[index]

      /*
       * Ø¥Ø°Ø§ Ø§Ù„ÙˆØ³Ù… ÙØ§Ø±ØºØŒ Content Guard
       * Ø³ÙŠØ¹Ø·ÙŠ Error Ù…Ø³ØªÙ‚Ù„.
       */
      if (
        !hasTagContent(
          sourcePair.content,
          profileId,
        ) ||
        !hasTagContent(
          translatedPair.content,
          profileId,
        )
      ) {
        continue
      }

      const sourceScope =
        getTagScopeShape(
          source,
          sourcePair,
          profileId,
        )

      const translationScope =
        getTagScopeShape(
          translation,
          translatedPair,
          profileId,
        )

      if (
        sourceScope ===
        translationScope
      ) {
        continue
      }

      issues.push({
        kind:
          'tag-scope-changed',

        severity:
          'warning',

        token:
          translatedPair.opening,

        message:
          `${translatedPair.opening.raw} wraps ${describeTagScope(sourceScope)} in the source, but ${describeTagScope(translationScope)} in the translation.`,
      })
    }
  }

  return issues
}

function dedupeIssues(
  issues: TokenValidationIssue[],
): TokenValidationIssue[] {
  const seen =
    new Set<string>()

  const unique:
    TokenValidationIssue[] = []

  for (const issue of issues) {
    const key = [
      issue.kind,
      issue.severity,
      issue.message,
      issue.token?.raw ?? '',
    ].join('|')

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(issue)
  }

  return unique
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

  const missingTokens:
    ProtectedToken[] = []

  const extraTokens:
    ProtectedToken[] = []

  /*
   * Missing protected tokens.
   *
   * Missing = blocking error.
   */
  for (
    const [raw, sourceMatches]
    of sourceGroups
  ) {
    const translationMatches =
      translationGroups.get(raw) ?? []

    const missingCount =
      sourceMatches.length -
      translationMatches.length

    if (missingCount <= 0) {
      continue
    }

    missingTokens.push(
      ...sourceMatches.slice(
        translationMatches.length,
      ),
    )
  }

  /*
   * Extra protected tokens.
   *
   * Extra = blocking error.
   */
  for (
    const [raw, translationMatches]
    of translationGroups
  ) {
    const sourceMatches =
      sourceGroups.get(raw) ?? []

    const extraCount =
      translationMatches.length -
      sourceMatches.length

    if (extraCount <= 0) {
      continue
    }

    extraTokens.push(
      ...translationMatches.slice(
        sourceMatches.length,
      ),
    )
  }

  /*
   * Non-blocking warnings.
   */
  const placementIssues =
    dedupeIssues([
      ...detectGenericPlacementIssues(
        source,
        translation,
        sourceGroups,
        translationGroups,
        profileId,
      ),

      ...detectTokenOrderIssues(
        sourceTokens,
        translationTokens,
        missingTokens,
        extraTokens,
      ),

      ...detectTagScopeIssues(
        source,
        translation,
        sourceTokens,
        translationTokens,
        profileId,
      ),
    ])

  /*
   * Structural issues are blocking.
   */
  const structureIssues =
    dedupeIssues([
      ...detectTagStructureIssues(
        sourceTokens,
        translationTokens,
      ),

      ...detectTagContentIssues(
        source,
        translation,
        sourceTokens,
        translationTokens,
        profileId,
      ),
    ])

  const allIssues =
    dedupeIssues([
      ...placementIssues,
      ...structureIssues,
    ])

  const errors =
    allIssues.filter(
      (issue) =>
        issue.severity ===
        'error',
    )

  const warnings =
    allIssues.filter(
      (issue) =>
        issue.severity ===
        'warning',
    )

  /*
   * Missing / Extra are represented
   * in their dedicated arrays rather
   * than duplicated as generic issues.
   *
   * Ù„ÙƒÙ†Ù‡Ù… ÙŠØ¸Ù„ÙˆÙ† Blocking Errors.
   */
  const hasErrors =
    missingTokens.length > 0 ||
    extraTokens.length > 0 ||
    errors.length > 0

  const hasWarnings =
    warnings.length > 0

  return {
    sourceTokens,
    translationTokens,

    missingTokens,
    extraTokens,

    placementIssues,
    structureIssues,

    errors,
    warnings,

    isValid:
      !hasErrors,

    hasErrors,
    hasWarnings,
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
