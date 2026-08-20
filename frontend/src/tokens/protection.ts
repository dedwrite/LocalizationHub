import {
  extractProtectedTokens,
} from './index'

import type {
  TokenProfileId,
} from './types'

export function isFullyProtectedText(
  text: string,
  profileId: TokenProfileId = 'generic',
): boolean {
  const tokens =
    extractProtectedTokens(
      text,
      profileId,
    )

  if (tokens.length === 0) {
    return false
  }

  let remaining = ''
  let cursor = 0

  for (const token of tokens) {
    remaining += text.slice(
      cursor,
      token.start,
    )

    cursor = token.end
  }

  remaining +=
    text.slice(cursor)

  /*
   * إذا ما بقي إلا whitespace،
   * فكل محتوى السطر Protected.
   */
  return (
    remaining.trim().length === 0
  )
}