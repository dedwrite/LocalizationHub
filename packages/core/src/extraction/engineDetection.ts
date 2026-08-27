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
}

const UNREAL_EXTENSIONS = new Set(['.pak', '.utoc', '.ucas', '.uasset', '.uexp', '.ubulk', '.locres', '.locmeta', '.umap'])
const GODOT_EXTENSIONS = new Set(['.pck', '.godot', '.tres', '.res', '.tscn', '.scn', '.translation', '.gd'])
const UNITY_FILES = new Set(['globalgamemanagers', 'data.unity3d', 'resources.assets', 'level0', 'projectversion.txt'])
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
  const unityDataDir = hasDirectoryEnding(input.directories, UNITY_DIRECTORY_SUFFIXES)
  const unityAssetsCount = input.files.filter((file) => /(^|\/)(resources|sharedassets\d*|globalgamemanagers)\.assets$/u.test(file.lower)).length
  if (unityDataDir) evidence.push('Unity *_Data directory present')
  if (unityAssetsCount > 0) evidence.push(`${unityAssetsCount} Unity serialized asset file(s)`)
  if (unityFileCount > 0) evidence.push('Unity signature file(s) present')

  const inkCount = input.files.filter((file) => file.lower.endsWith('.ink') || file.lower.endsWith('.ink.json') || file.lower.endsWith('.json') && file.lower.includes('ink')).length
  if (inkCount > 0) evidence.push(`${inkCount} Ink file(s)`)

  // Score-based decision. Prefer the strongest, most specific signal.
  const scores: Array<{ engine: EngineFamily; score: number }> = [
    { engine: 'unreal', score: unrealCount > 0 ? 100 : 0 },
    { engine: 'godot', score: (godotProjectFile ? 60 : 0) + (godotCount > 0 ? 50 : 0) },
    { engine: 'unity', score: (unityDataDir ? 60 : 0) + (unityAssetsCount > 0 ? 50 : 0) + (unityFileCount > 0 ? 30 : 0) },
    { engine: 'ink', score: inkCount > 0 ? 90 : 0 },
  ]

  const best = scores.reduce((a, b) => (b.score > a.score ? b : a), { engine: 'generic' as EngineFamily, score: 0 })

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
