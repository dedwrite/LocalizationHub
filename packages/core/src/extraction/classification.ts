/*
 * String translatability classification and scoring.
 *
 * Distinguishes natural-language content from technical identifiers, paths,
 * GUIDs, hashes, enums, and serialization metadata. This is the anti-grep:
 * a string is only classified translatable when there is positive evidence.
 *
 * All functions are pure and deterministic.
 */

import type {
  Confidence,
  EntryClassification,
} from './types'

export type ClassificationReason =
  | 'natural-language-whitespace'
  | 'natural-language-punctuation'
  | 'sentence-structure'
  | 'known-localized-field'
  | 'ui-component-text'
  | 'localization-table-membership'
  | 'dialogue-schema'
  | 'subtitle-schema'
  | 'is-file-path'
  | 'is-url'
  | 'is-guid'
  | 'is-hash'
  | 'is-enum'
  | 'is-class-or-property-name'
  | 'is-object-path'
  | 'is-resource-reference'
  | 'is-code'
  | 'is-regex'
  | 'is-identifier'
  | 'is-short-machine-token'
  | 'is-locale-code'

export type ClassificationDecision = {
  classification: EntryClassification
  confidence: Confidence
  translatable: boolean
  score: number
  reasons: ClassificationReason[]
}

const GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const HASH_PATTERN =
  /^[0-9a-fA-F]{16,}$/

const LOCALE_CODE_PATTERN =
  /^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/

const IDENTIFIER_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_]*$/

const ENUM_PATTERN =
  /^[A-Z][A-Z0-9_]*$/

const RESOURCE_REFERENCE_PATTERN =
  /^(?:res|uid):\/\//

const OBJECT_PATH_PATTERN =
  /^\/?(?:Game|Content|Script|Engine)\//

const CODE_PATTERN =
  /[{}();=<>]|function\s*\(|=>|\.class\b/

function hasNaturalWhitespace(text: string): boolean {
  return /\s/u.test(text.trim())
}

function hasSentencePunctuation(text: string): boolean {
  return /[.!?…]["')\]]?\s|^[.!?…]$|[.!?…]$/u.test(text.trim())
}

function looksLikeSentence(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 2) return false
  // At least one letter, and more letters/words than machine tokens.
  const letters = (trimmed.match(/[\p{L}]/gu) ?? []).length
  if (letters === 0) return false
  // A single bare identifier or enum is not a sentence.
  if (IDENTIFIER_PATTERN.test(trimmed)) return false
  if (ENUM_PATTERN.test(trimmed)) return false
  return true
}

function isPath(text: string): boolean {
  const t = text.trim()
  return (
    RESOURCE_REFERENCE_PATTERN.test(t) ||
    OBJECT_PATH_PATTERN.test(t) ||
    /^[A-Za-z]:[\\/]/u.test(t) ||
    /(^|\s)(\.\.?[\\/])/u.test(t) ||
    /^\/[\w./-]+\/?$/u.test(t)
  )
}

export function classifyString(
  text: string,
  hints: {
    knownLocalizedField?: boolean
    uiComponentField?: boolean
    localizationTableMembership?: boolean
    dialogueSchema?: boolean
    subtitleSchema?: boolean
  } = {},
): ClassificationDecision {
  const trimmed = text.trim()
  const reasons: ClassificationReason[] = []
  let score = 0

  // A structural hint tells us the field is meant to be displayed text, so a
  // single-word value like "Settings" or "Play" is UI text, not a code
  // identifier.
  const hasStructuralHint =
    Boolean(hints.knownLocalizedField) ||
    Boolean(hints.uiComponentField) ||
    Boolean(hints.localizationTableMembership) ||
    Boolean(hints.dialogueSchema) ||
    Boolean(hints.subtitleSchema)

  if (trimmed.length === 0) {
    return {
      classification: 'NonTranslatable',
      confidence: 'high',
      translatable: false,
      score: -100,
      reasons: ['is-short-machine-token'],
    }
  }

  // --- Negative signals (technical / structural) ---
  if (GUID_PATTERN.test(trimmed)) {
    reasons.push('is-guid')
    score -= 40
  }
  if (HASH_PATTERN.test(trimmed)) {
    reasons.push('is-hash')
    score -= 40
  }
  if (isPath(trimmed)) {
    reasons.push(trimmed.startsWith('res://') || trimmed.startsWith('uid://') ? 'is-resource-reference' : 'is-object-path')
    score -= 50
  }
  if (/^https?:\/\/\S+$/iu.test(trimmed)) {
    reasons.push('is-url')
    score -= 50
  }
  // Identifier/enum/locale-code penalties only apply when there is no
  // structural hint that this is display text.
  if (!hasStructuralHint) {
    if (IDENTIFIER_PATTERN.test(trimmed) && !hasNaturalWhitespace(trimmed)) {
      reasons.push('is-identifier')
      score -= 25
    }
    if (ENUM_PATTERN.test(trimmed) && !hasNaturalWhitespace(trimmed)) {
      reasons.push('is-enum')
      score -= 25
    }
    if (LOCALE_CODE_PATTERN.test(trimmed) && !hasNaturalWhitespace(trimmed) && trimmed.length <= 12) {
      reasons.push('is-locale-code')
      score -= 30
    }
  }
  if (CODE_PATTERN.test(trimmed) && !hasNaturalWhitespace(trimmed)) {
    reasons.push('is-code')
    score -= 20
  }

  // --- Positive signals (natural language) ---
  if (hasNaturalWhitespace(trimmed)) {
    reasons.push('natural-language-whitespace')
    score += 25
  }
  if (hasSentencePunctuation(trimmed)) {
    reasons.push('natural-language-punctuation')
    score += 20
  }
  if (looksLikeSentence(trimmed)) {
    reasons.push('sentence-structure')
    score += 20
  }
  if (hints.knownLocalizedField) {
    reasons.push('known-localized-field')
    score += 30
  }
  if (hints.uiComponentField) {
    reasons.push('ui-component-text')
    score += 15
  }
  if (hints.localizationTableMembership) {
    reasons.push('localization-table-membership')
    score += 30
  }
  if (hints.dialogueSchema) {
    reasons.push('dialogue-schema')
    score += 25
  }
  if (hints.subtitleSchema) {
    reasons.push('subtitle-schema')
    score += 25
  }

  const translatable = score >= 0

  let confidence: Confidence = 'low'
  if (score >= 30) confidence = 'high'
  else if (score >= 0) confidence = 'medium'

  let classification: EntryClassification = 'Unknown'
  if (!translatable) {
    classification = 'NonTranslatable'
  } else if (hints.dialogueSchema) {
    classification = 'Dialogue'
  } else if (hints.subtitleSchema) {
    classification = 'Subtitle'
  } else if (hints.uiComponentField) {
    classification = 'UI'
  } else if (hints.knownLocalizedField) {
    classification = 'UI'
  }

  return {
    classification,
    confidence,
    translatable,
    score,
    reasons,
  }
}

/*
 * Classify a field into a more specific category using its name and, when
 * available, the record's surrounding structure. Returns `Unknown` when there
 * is not enough evidence.
 */
export function classifyFieldName(
  fieldName: string,
): EntryClassification {
  const normalized = fieldName.toLowerCase()

  if (/dialogue|line|spoken|quote|response|utterance/.test(normalized)) return 'Dialogue'
  if (/subtitle|caption/.test(normalized)) return 'Subtitle'
  if (/quest|objective|mission|task-title/.test(normalized)) return 'Quest'
  if (/objective/.test(normalized)) return 'Objective'
  if (/item[-_ ]?name|item_name/.test(normalized)) return 'ItemName'
  if (/item[-_ ]?desc|description/.test(normalized)) return 'ItemDescription'
  if (/character[-_ ]?name|char_name/.test(normalized)) return 'CharacterName'
  if (/location[-_ ]?name|place[-_ ]?name/.test(normalized)) return 'LocationName'
  if (/choice|option|answer/.test(normalized)) return 'Choice'
  if (/tutorial|hint|tip/.test(normalized)) return 'Tutorial'
  if (/notification|toast|banner|announce/.test(normalized)) return 'Notification'
  if (/system[-_ ]?message|error[-_ ]?message/.test(normalized)) return 'SystemMessage'
  if (/lore|codex|journal|book|letter/.test(normalized)) return 'Codex'
  if (/achievement|trophy/.test(normalized)) return 'Achievement'
  if (/menu|title|label|button|header/.test(normalized)) return 'Menu'

  return 'Unknown'
}
