export type TokenKind =
  | 'variable'
  | 'format'
  | 'opening-tag'
  | 'closing-tag'
  | 'self-closing-tag'
  | 'escape'
  | 'control-code'

export type TokenProfileId =
  | 'auto'
  | 'generic'
  | 'godot'
  | 'unity'
  | 'unreal'
  | 'renpy'
  | 'custom'

export type ResolvedTokenProfileId =
  | 'generic'
  | 'godot'
  | 'unity'
  | 'unreal'

export type TokenProfileMode = 'auto' | 'manual'

export type TokenProfileDetection = {
  engine: 'unity' | 'unreal' | 'godot' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
}

export type TokenProfileConfig = {
  mode: TokenProfileMode
  selectedProfile?: ResolvedTokenProfileId
  resolvedProfile: ResolvedTokenProfileId
  detection: TokenProfileDetection
}

export type ProtectedToken = {
  raw: string
  kind: TokenKind
  start: number
  end: number
  ruleId: string
}

export type TokenRule = {
  id: string
  kind: TokenKind
  pattern: RegExp
}

export type TokenIssueSeverity =
  | 'error'
  | 'warning'

export type TokenIssueKind =
  | 'token-placement-changed'
  | 'token-order-changed'
  | 'tag-structure-invalid'
  | 'tag-content-empty'
  | 'tag-scope-changed'

export type TokenValidationIssue = {
  kind: TokenIssueKind
  severity: TokenIssueSeverity
  message: string
  token?: ProtectedToken
}

export type TokenValidationResult = {
  sourceTokens: ProtectedToken[]
  translationTokens: ProtectedToken[]

  missingTokens: ProtectedToken[]
  extraTokens: ProtectedToken[]

  /*
   * Non-blocking observations.
   *
   * Example:
   * {0} moved from the middle to
   * the end because Arabic syntax
   * required a different order.
   */
  placementIssues: TokenValidationIssue[]

  /*
   * Structural problems with paired
   * tags and protected formatting.
   */
  structureIssues: TokenValidationIssue[]

  /*
   * Flattened collections that make
   * UI logic and tests easier.
   */
  errors: TokenValidationIssue[]
  warnings: TokenValidationIssue[]

  /*
   * isValid means:
   * "safe enough to export".
   *
   * Warnings do NOT make this false.
   * Blocking errors do.
   */
  isValid: boolean

  hasErrors: boolean
  hasWarnings: boolean
}

export type TokenProfile = {
  id: TokenProfileId
  label: string
  description: string
  extract: (text: string) => ProtectedToken[]
}
