export type ProgressPulseState = {
  dayKey: string
  translatedDelta: number
  approvedDelta: number
  sessionTranslated: number
  sessionApproved: number
}

const STORAGE_KEY = 'localizationhub.progress-pulse.v1'

function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function emptyState(date = new Date()): ProgressPulseState {
  return {
    dayKey: dayKey(date),
    translatedDelta: 0,
    approvedDelta: 0,
    sessionTranslated: 0,
    sessionApproved: 0,
  }
}

export function loadProgressPulse(): ProgressPulseState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as ProgressPulseState
    if (parsed.dayKey !== dayKey()) {
      return {
        ...emptyState(),
        sessionTranslated: Number(parsed.sessionTranslated) || 0,
        sessionApproved: Number(parsed.sessionApproved) || 0,
      }
    }
    return {
      dayKey: parsed.dayKey,
      translatedDelta: Math.max(0, Number(parsed.translatedDelta) || 0),
      approvedDelta: Math.max(0, Number(parsed.approvedDelta) || 0),
      sessionTranslated: Math.max(0, Number(parsed.sessionTranslated) || 0),
      sessionApproved: Math.max(0, Number(parsed.sessionApproved) || 0),
    }
  } catch {
    return emptyState()
  }
}

export function saveProgressPulse(state: ProgressPulseState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Optional UI bookmark only.
  }
}

export function recordProgressPulse(input: {
  becameTranslated?: boolean
  becameApproved?: boolean
}): ProgressPulseState {
  const current = loadProgressPulse()
  const next: ProgressPulseState = {
    ...current,
    dayKey: dayKey(),
    translatedDelta: current.translatedDelta + (input.becameTranslated ? 1 : 0),
    approvedDelta: current.approvedDelta + (input.becameApproved ? 1 : 0),
    sessionTranslated: current.sessionTranslated + (input.becameTranslated ? 1 : 0),
    sessionApproved: current.sessionApproved + (input.becameApproved ? 1 : 0),
  }
  saveProgressPulse(next)
  return next
}

export function hasProgressPulse(state: ProgressPulseState): boolean {
  return state.sessionTranslated > 0 || state.sessionApproved > 0 || state.translatedDelta > 0 || state.approvedDelta > 0
}
