/*
 * Confidence-based engine detection.
 *
 * Detects Unreal / Godot / Unity / Ink / generic from file names, directory
 * layout, and known signatures. Never silently guesses — a low-confidence
 * result is explicitly low confidence, and detection carries evidence.
 */

import type {
  Confidence,
  EngineDetection,
  EngineFamily,
} from './types'

export type FileSignature = {
  name: string
  lower: string
}

export type DirectorySignature = {
  name: string
  lower: string
}

export type DetectionInput = {
  files: FileSignature[]
  directories: DirectorySignature[]
  /** Authoritative engine metadata from an accepted extraction pass. */
  extractionEngine?: EngineFamily
  /** Optional text samples used only as low-confidence supporting evidence. */
  contentSamples?: string[]
}

const UNREAL_EXTENSIONS = new Set(['.pak', '.utoc', '.ucas', '.uasset', '.uexp', '.ubulk', '.locres', '.locmeta', '.umap'])
const GODOT_EXTENSIONS = new Set(['.pck', '.godot', '.tres', '.res', '.tscn', '.scn', '.translation', '.gd', '.inkb'])
const UNITY_FILES = new Set(['globalgamemanagers', 'data.unity3d', 'resources.assets', 'level0', 'projectversion.txt'])
const UNITY_EXTENSIONS = new Set(['.bundle', '.unity3d', '.assets', '.asset'])
const UNITY_DIRECTORY_SUFFIXES = ['_data', 'streamingassets', 'addressables']

function countByExtension(files: FileSignature[], extensions: Set<string>): number {
  return files.filter((file) => {
    const dot = file.lower.lastIndexOf('.')
    if (dot === -1) return false
    return extensions.has(file.lower.slice(dot))
  }).length
}

function hasFileName(files: FileSignature[], names: Set<string>): number {
  return files.filter((file) => names.has(file.lower)).length
}

function hasDirectoryEnding(directories: DirectorySignature[], suffixes: string[]): boolean {
  return directories.some((dir) => suffixes.some((suffix) => dir.lower.endsWith(suffix)))
}

export function detectEngine(input: DetectionInput): EngineDetection {
  if (input.extractionEngine && ['godot', 'unity', 'unreal'].includes(input.extractionEngine)) {
    const label = input.extractionEngine === 'unreal' ? 'Unreal Engine' : input.extractionEngine === 'unity' ? 'Unity' : 'Godot'
    return {
      engine: input.extractionEngine,
      familyLabel: label,
      confidence: 'high',
      evidence: [`authoritative extraction metadata: ${label}`],
    }
  }
  const evidence: string[] = []

  const unrealCount = countByExtension(input.files, UNREAL_EXTENSIONS)
  if (unrealCount > 0) {
    evidence.push(`${unrealCount} Unreal resource file(s) (.pak/.utoc/.ucas/.uasset/.locres...)`)
  }

  const godotCount = countByExtension(input.files, GODOT_EXTENSIONS)
  const godotProjectFile = input.files.some((file) => file.lower === 'project.godot')
  if (godotProjectFile) evidence.push('project.godot present')
  if (godotCount > 0) evidence.push(`${godotCount} Godot resource file(s) (.pck/.tscn/.tres/.translation...)`)

  const unityFileCount = hasFileName(input.files, UNITY_FILES)
  const unityLevelCount = input.files.filter((file) => /^level\d+$/u.test(file.lower)).length
  const unityExtensionCount = countByExtension(input.files, UNITY_EXTENSIONS)
  const unityDataDir = hasDirectoryEnding(input.directories, UNITY_DIRECTORY_SUFFIXES)
  const unityAssetsCount = input.files.filter((file) => /(^|\/)(resources|sharedassets\d*|globalgamemanagers)\.assets$/u.test(file.lower)).length
  if (unityDataDir) evidence.push('Unity *_Data directory present')
  if (unityAssetsCount > 0) evidence.push(`${unityAssetsCount} Unity serialized asset file(s)`)
  if (unityExtensionCount > 0) evidence.push(`${unityExtensionCount} Unity asset/bundle file(s) (.bundle/.unity3d/.assets)`)
  if (unityFileCount > 0 || unityLevelCount > 0) evidence.push('Unity signature file(s) present')

  const inkCount = input.files.filter((file) => file.lower.endsWith('.ink') || file.lower.endsWith('.ink.json') || file.lower.endsWith('.json') && file.lower.includes('ink')).length
  if (inkCount > 0) evidence.push(`${inkCount} Ink file(s)`)

  const samples = input.contentSamples ?? []
  const contentSignals = {
    unreal: samples.filter((sample) => /\|(?:plural|gender|hpp)\s*\(/u.test(sample)).length,
    unity: samples.filter((sample) => /\{[^{}\r\n]+:(?:plural|choose|select|list)(?:\([^{}]*\))?/u.test(sample)).length,
    godot: samples.filter((sample) => /\[\$[^\]]+\]|(?<![\p{L}\p{N}])%[A-Za-z_][A-Za-z0-9_]*/u.test(sample)).length,
  }
  if (contentSignals.unreal > 0) evidence.push(`${contentSignals.unreal} Unreal format signature(s)`)
  if (contentSignals.unity > 0) evidence.push(`${contentSignals.unity} Unity Smart String signature(s)`)
  if (contentSignals.godot > 0) evidence.push(`${contentSignals.godot} Godot format signature(s)`)

  // Score-based decision. Prefer the strongest, most specific signal. Large
  // numbers of a single engine's resources are strong evidence even without a
  // project file (e.g. a recovered PCK may not surface project.godot at the
  // scan root).
  const godotScore = godotProjectFile
    ? 100
    : godotCount >= 100
      ? 100
      : godotCount >= 10
        ? 60
        : godotCount > 0
          ? 30
          : 0
  const unityScore =
    (unityDataDir ? 60 : 0) +
    (unityAssetsCount > 0 ? 50 : 0) +
    (unityExtensionCount >= 100 ? 100 : unityExtensionCount >= 10 ? 40 : unityExtensionCount > 0 ? 25 : 0) +
    ((unityFileCount > 0 || unityLevelCount > 0) ? 30 : 0)

  const scores: Array<{ engine: EngineFamily; score: number }> = [
    { engine: 'unreal', score: unrealCount > 0 ? 100 : contentSignals.unreal >= 2 ? 40 : 0 },
    { engine: 'godot', score: godotScore },
    { engine: 'unity', score: unityScore || (contentSignals.unity >= 2 ? 40 : 0) },
    { engine: 'ink', score: inkCount > 0 ? 90 : 0 },
  ]

  const best = scores.reduce((a, b) => (b.score > a.score ? b : a), { engine: 'generic' as EngineFamily, score: 0 })

  const tied = scores.filter((item) => item.score > 0 && item.score === best.score)
  if (tied.length > 1) {
    return {
      engine: 'generic',
      familyLabel: 'Unknown / Generic',
      confidence: 'low',
      evidence: [...evidence, `ambiguous signals: ${tied.map((item) => item.engine).join(', ')}`],
    }
  }

  if (best.score === 0) {
    return {
      engine: 'generic',
      familyLabel: 'Unknown / Generic',
      confidence: 'low',
      evidence,
    }
  }

  let confidence: Confidence = 'low'
  if (best.score >= 100) confidence = 'high'
  else if (best.score >= 60) confidence = 'medium'

  const labels: Record<EngineFamily, string> = {
    unreal: 'Unreal Engine',
    godot: 'Godot',
    unity: 'Unity',
    ink: 'Ink',
    generic: 'Unknown / Generic',
  }

  return {
    engine: best.engine,
    familyLabel: labels[best.engine],
    confidence,
    evidence,
  }
}
