import type { MessageKey } from '@localizationhub/i18n'

export const tipDecks = {
  landing: ['delight.tipContext', 'delight.tipTokens', 'delight.tipRead', 'delight.tipPause', 'delight.landingIntent', 'delight.landingVoice', 'delight.landingSpace', 'delight.landingCulture', 'delight.landingNames', 'delight.landingContext', 'delight.landingPunctuation', 'delight.landingAudience', 'delight.landingLiteral', 'delight.landingHotfix', 'delight.landingConstraints', 'delight.landingPlural'],
  local: ['delight.tipBackup', 'delight.tipLocal', 'delight.tipSave', 'delight.tipTokens', 'delight.localOriginal', 'delight.localDevice', 'delight.localPrivate', 'delight.localExport', 'delight.localSelection', 'delight.localIndependent', 'delight.localDelete', 'delight.localFileName', 'delight.localStorage', 'delight.localMt', 'delight.localSample', 'delight.localTermNote'],
  projects: ['delight.tipCloud', 'delight.tipNames', 'delight.tipReview', 'delight.tipContext', 'delight.projectHandoff', 'delight.projectComments', 'delight.projectRoles', 'delight.projectSearch', 'delight.projectRevision', 'delight.projectScope', 'delight.projectPercent', 'delight.projectViewer', 'delight.projectLocal', 'delight.projectRefresh', 'delight.projectTermBank', 'delight.projectToneGuide'],
  editor: ['delight.tipContext', 'delight.tipGlossary', 'delight.tipSource', 'delight.tipPause', 'delight.editorPronouns', 'delight.editorGender', 'delight.editorAmbiguity', 'delight.editorPlaceholders', 'delight.editorHumor', 'delight.editorRegister', 'delight.editorNumbers', 'delight.editorLineBreaks', 'delight.editorProfile', 'delight.editorSuggestion', 'delight.editorEllipsis', 'delight.editorRepeated'],
  review: ['delight.tipReview', 'delight.tipTags', 'delight.tipTone', 'delight.tipRead', 'delight.reviewConsistency', 'delight.reviewNegation', 'delight.reviewTags', 'delight.reviewWhitespace', 'delight.reviewUi', 'delight.reviewArabic', 'delight.reviewEmpty', 'delight.reviewApprove', 'delight.reviewFreshEyes', 'delight.reviewLastString', 'delight.reviewHomoglyphs', 'delight.reviewCalque'],
} as const satisfies Record<string, readonly MessageKey[]>
export type TipContext = keyof typeof tipDecks

/** Choose only on mount or explicit request; never from a typing/render timer. */
export function chooseTip(length: number, previous = -1, random = Math.random): number {
  if (length <= 1) return 0
  const skip = previous >= 0 && previous < length
  const pick = Math.floor(Math.min(.999999999, Math.max(0, random())) * (length - (skip ? 1 : 0)))
  return skip && pick >= previous ? pick + 1 : pick
}

/** A shuffled bag: exhaust a context before repeating any tip. Avoid a repeat
 * at the bag boundary too. Only IDs/ordering live in component memory. */
export function shuffledTips(length: number, previous = -1, random = Math.random): number[] {
  const order = Array.from({ length }, (_, index) => index)
  for (let index = length - 1; index > 0; index--) {
    const other = chooseTip(index + 1, -1, random)
    ;[order[index], order[other]] = [order[other], order[index]]
  }
  if (length > 1 && order[0] === previous) [order[0], order[1]] = [order[1], order[0]]
  return order
}

export const tipPreferenceKey = (context: TipContext) => `localizationhub.tips.hidden.${context}.v1`
export function tipsHidden(context: TipContext) {
  try { return localStorage.getItem(tipPreferenceKey(context)) === '1' } catch { return false }
}
export function setTipsHidden(context: TipContext, hidden: boolean) {
  try { localStorage.setItem(tipPreferenceKey(context), hidden ? '1' : '0') } catch { /* Optional preference; the current view still works. */ }
}
