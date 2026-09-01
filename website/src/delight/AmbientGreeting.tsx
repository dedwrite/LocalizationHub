import { useMemo } from 'react'
import { useI18n, type MessageKey } from '@localizationhub/i18n'

export function greetingKey(date: Date): MessageKey {
  const hour = date.getHours()
  if (date.getDay() === 5 && hour >= 18) return 'delight.greetingFriday'
  if (hour < 5 || hour >= 23) return 'delight.greetingLate'
  if (hour < 12) return 'delight.greetingMorning'
  if (hour < 18) return 'delight.greetingAfternoon'
  return 'delight.greetingEvening'
}

export default function AmbientGreeting({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  const key = useMemo(() => greetingKey(new Date()), [])
  return <p className={`ambient-greeting ${className}`.trim()} data-i18n-skip><span aria-hidden="true">✦</span>{t(key)}</p>
}
