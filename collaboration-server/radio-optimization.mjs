import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { analyzeRadioAudio } from './radio-analysis.mjs'

const execFileAsync = promisify(execFile)

export const OPTIMIZATION_PROFILES = {
  high: { label: 'High Quality', bitrateKbps: 192 },
  saver: { label: 'Storage Saver', bitrateKbps: 128 },
}

export function recommendRadioOptimization(analysis) {
  const bitrate = Number(analysis?.bitrateKbps)
  const duration = Number(analysis?.durationSeconds)
  const size = Number(analysis?.sizeBytes)
  if (!Number.isFinite(bitrate) || !Number.isFinite(duration) || !Number.isFinite(size) || duration < 30) return { recommended: false, reason: 'insufficient-data' }
  if (bitrate <= 160) return { recommended: false, reason: 'already-efficient' }
  const target = bitrate > 224 ? 192 : 160
  const estimatedBytes = Math.round(size * target / bitrate)
  const savings = Math.max(0, 1 - estimatedBytes / size)
  return { recommended: savings >= 0.15, reason: savings >= 0.15 ? 'meaningful-saving' : 'small-saving', targetBitrateKbps: target, estimatedBytes, estimatedSavingsPercent: Math.round(savings * 100) }
}

export async function detectFfmpeg(ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg') {
  try {
    const result = await execFileAsync(ffmpegPath, ['-version'], { timeout: 3000, windowsHide: true, maxBuffer: 100000 })
    return { available: true, path: ffmpegPath, version: String(result.stdout).split('\n')[0] }
  } catch { return { available: false, path: ffmpegPath, version: null } }
}

export async function optimizeRadioMp3(buffer, { profile = 'high', ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg' } = {}) {
  const selected = OPTIMIZATION_PROFILES[profile]
  if (!selected) throw new Error('Unknown optimization profile.')
  const availability = await detectFfmpeg(ffmpegPath)
  if (!availability.available) throw new Error('Audio optimization is unavailable because ffmpeg is not installed.')
  const directory = await mkdtemp(join(tmpdir(), 'localizationhub-radio-'))
  const input = join(directory, 'input.mp3')
  const output = join(directory, 'output.mp3')
  try {
    await writeFile(input, buffer, { mode: 0o600 })
    await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map_metadata', '0', '-vn', '-codec:a', 'libmp3lame', '-b:a', `${selected.bitrateKbps}k`, output], { timeout: 120000, windowsHide: true, maxBuffer: 100000 })
    const optimized = await readFile(output)
    const analysis = await analyzeRadioAudio(optimized, { filename: 'optimized.mp3' })
    return { buffer: optimized, analysis, profile, originalSizeBytes: buffer.length, newSizeBytes: optimized.length }
  } finally { await rm(directory, { recursive: true, force: true }).catch(() => {}) }
}

