export type TokenKind =
  | 'variable'
  | 'format'
  | 'opening-tag'
  | 'closing-tag'
  | 'self-closing-tag'
  | 'escape'
  | 'control-code'

export type TokenProfileId =
  | 'generic'
  | 'godot'
  | 'unity'
  | 'unreal'
  | 'renpy'
  | 'custom'

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

export type TokenValidationResult = {
  sourceTokens: ProtectedToken[]
  translationTokens: ProtectedToken[]

  missingTokens: ProtectedToken[]
  extraTokens: ProtectedToken[]
  misplacedTokens: ProtectedToken[]

  orderMismatch: boolean

  isValid: boolean
}

export type TokenProfile = {
  id: TokenProfileId
  label: string
  description: string
  extract: (text: string) => ProtectedToken[]
}