import type { EngineDetection } from '../extraction/types'
import type {
  ResolvedTokenProfileId,
  TokenProfileConfig,
  TokenProfileDetection,
  TokenProfileId,
} from './types'

export const TOKEN_PROFILE_LABELS: Record<ResolvedTokenProfileId, string> = {
  generic: 'Generic',
  godot: 'Godot',
  unreal: 'Unreal Engine',
  unity: 'Unity',
}

export function detectionFromEngine(engine: EngineDetection | undefined): TokenProfileDetection {
  const detectedEngine = engine?.engine
  const supported = detectedEngine === 'godot' || detectedEngine === 'unity' || detectedEngine === 'unreal'
  return {
    engine: supported ? detectedEngine : 'unknown',
    confidence: engine?.confidence ?? 'low',
    evidence: (engine?.evidence ?? []).slice(0, 4),
  }
}

export function resolveTokenProfile(profile: TokenProfileId, detection?: TokenProfileDetection): ResolvedTokenProfileId {
  if (profile !== 'auto') return profile === 'godot' || profile === 'unity' || profile === 'unreal' ? profile : 'generic'
  if (detection?.engine === 'godot' || detection?.engine === 'unity' || detection?.engine === 'unreal') return detection.engine
  return 'generic'
}

export function createTokenProfileConfig(
  profile: TokenProfileId = 'auto',
  detection: TokenProfileDetection = { engine: 'unknown', confidence: 'low', evidence: [] },
): TokenProfileConfig {
  const mode = profile === 'auto' ? 'auto' : 'manual'
  return {
    mode,
    selectedProfile: mode === 'manual' ? resolveTokenProfile(profile) : undefined,
    resolvedProfile: resolveTokenProfile(profile, detection),
    detection: { ...detection, evidence: detection.evidence.slice(0, 4) },
  }
}

export function updateTokenProfileConfig(
  config: TokenProfileConfig | undefined,
  profile: TokenProfileId,
  detection?: TokenProfileDetection,
): TokenProfileConfig {
  return createTokenProfileConfig(profile, detection ?? config?.detection)
}

export function displayTokenProfile(config: TokenProfileConfig): string {
  return config.mode === 'auto'
    ? `Auto · ${TOKEN_PROFILE_LABELS[config.resolvedProfile]}`
    : TOKEN_PROFILE_LABELS[config.selectedProfile ?? config.resolvedProfile]
}
