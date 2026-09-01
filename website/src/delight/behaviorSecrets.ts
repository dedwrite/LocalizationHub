import type { MessageKey } from '@localizationhub/i18n'

export type BehaviorSecretId = 'fridayComplete' | 'lateNightSave' | 'sundayComplete'

export type BehaviorSecret = {
  id: BehaviorSecretId
  titleKey: MessageKey
  bodyKey: MessageKey
}

const STORAGE_PREFIX = 'localizationhub.behavior-secret.seen.'

export function fridayNightComplete(date = new Date()): boolean {
  // Local Friday evening/night: Fri 18:00–Sat 04:59
  const day = date.getDay()
  const hour = date.getHours()
  if (day === 5 && hour >= 18) return true
  if (day === 6 && hour < 5) return true
  return false
}

export function sundayDaytimeComplete(date = new Date()): boolean {
  // Local Sunday morning/afternoon: Sun 08:00–16:59
  return date.getDay() === 0 && date.getHours() >= 8 && date.getHours() < 17
}

export function lateNightHour(date = new Date()): boolean {
  const hour = date.getHours()
  return hour >= 0 && hour < 5
}

export function secretSeen(id: BehaviorSecretId): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === '1'
  } catch {
    return false
  }
}

export function markSecretSeen(id: BehaviorSecretId): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, '1')
  } catch {
    // Ignore storage failures.
  }
}

export function discoverBehaviorSecret(input: {
  complete: boolean
  justSaved?: boolean
  now?: Date
}): BehaviorSecret | null {
  const now = input.now ?? new Date()
  if (input.complete && fridayNightComplete(now) && !secretSeen('fridayComplete')) {
    return {
      id: 'fridayComplete',
      titleKey: 'quiet.secretFridayTitle',
      bodyKey: 'quiet.secretFridayBody',
    }
  }
  if (input.complete && sundayDaytimeComplete(now) && !secretSeen('sundayComplete')) {
    return {
      id: 'sundayComplete',
      titleKey: 'quiet.secretSundayTitle',
      bodyKey: 'quiet.secretSundayBody',
    }
  }
  if (input.justSaved && lateNightHour(now) && !secretSeen('lateNightSave')) {
    return {
      id: 'lateNightSave',
      titleKey: 'quiet.secretLateTitle',
      bodyKey: 'quiet.secretLateBody',
    }
  }
  return null
}
