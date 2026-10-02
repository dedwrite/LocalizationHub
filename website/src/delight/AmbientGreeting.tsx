import { useEffect, useState } from 'react'
import { useI18n, type MessageKey } from '@localizationhub/i18n'
import Icon from '../components/Icon'

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
  const [key, setKey] = useState<MessageKey | null>(null)
  useEffect(() => { setKey(greetingKey(new Date())) }, [])
  if (!key) return null
  return <p className={`ambient-greeting time-greeting ${className}`.trim()} data-i18n-skip><Icon name="sparkle" size={14} />{t(key)}</p>
}
