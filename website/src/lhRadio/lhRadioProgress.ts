/** Return playback progress as a safe percentage for the collapsed cover ring. */
export function playbackProgressPercent(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0
  return Math.min(100, Math.max(0, (currentTime / duration) * 100))
}
