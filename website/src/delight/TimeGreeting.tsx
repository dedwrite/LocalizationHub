import { useMemo } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { ambienceTipKey, dayPart, greetingKey } from './timeAmbience'

export default function TimeGreeting({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const part = useMemo(() => dayPart(), [])
  return (
    <p className={`time-greeting ${compact ? 'is-compact' : ''}`} data-part={part} data-i18n-skip>
      <strong>{t(greetingKey(part))}</strong>
      {!compact && <span>{t(ambienceTipKey(part))}</span>}
    </p>
  )
}
