import type { MessageKey } from '@localizationhub/i18n'

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'late'

export function dayPart(date = new Date()): DayPart {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'late'
}

export function greetingKey(part: DayPart = dayPart()): MessageKey {
  if (part === 'morning') return 'quiet.greetMorning'
  if (part === 'afternoon') return 'quiet.greetAfternoon'
  if (part === 'evening') return 'quiet.greetEvening'
  return 'quiet.greetLate'
}

export function ambienceTipKey(part: DayPart = dayPart()): MessageKey {
  if (part === 'morning') return 'quiet.tipMorning'
  if (part === 'afternoon') return 'quiet.tipAfternoon'
  if (part === 'evening') return 'quiet.tipEvening'
  return 'quiet.tipLate'
}
