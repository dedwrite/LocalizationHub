/** Return playback progress as a safe percentage for the collapsed cover ring. */
export function playbackProgressPercent(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0
  return Math.min(100, Math.max(0, (currentTime / duration) * 100))
}

/** Build a clockwise capsule path that starts at the bottom-left tangent. */
export function capsuleProgressPath(width: number, height: number, inset = 1): string {
  const safeWidth = Math.max(width, inset * 2 + 2)
  const safeHeight = Math.max(height, inset * 2 + 2)
  const left = inset
  const top = inset
  const right = safeWidth - inset
  const bottom = safeHeight - inset
  const centerY = safeHeight / 2
  const radius = Math.min((safeHeight - inset * 2) / 2, (safeWidth - inset * 2) / 2)
  const startX = left + radius
  const endX = right - radius
  return `M ${startX} ${bottom} A ${radius} ${radius} 0 0 1 ${left} ${centerY} A ${radius} ${radius} 0 0 1 ${startX} ${top} H ${endX} A ${radius} ${radius} 0 0 1 ${right} ${centerY} A ${radius} ${radius} 0 0 1 ${endX} ${bottom} H ${startX} Z`
}
