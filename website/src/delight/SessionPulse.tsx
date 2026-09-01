import { useI18n } from '@localizationhub/i18n'
import { hasProgressPulse, type ProgressPulseState } from './pulseState'

export default function SessionPulse({ state }: { state: ProgressPulseState }) {
  const { t } = useI18n()
  if (!hasProgressPulse(state)) return null

  const parts: string[] = []
  if (state.sessionTranslated > 0) parts.push(t('quiet.pulseSessionTranslated', { count: state.sessionTranslated }))
  if (state.sessionApproved > 0) parts.push(t('quiet.pulseSessionApproved', { count: state.sessionApproved }))
  if (state.translatedDelta > 0 && state.translatedDelta !== state.sessionTranslated) {
    parts.push(t('quiet.pulseTodayTranslated', { count: state.translatedDelta }))
  }

  if (parts.length === 0) return null

  return (
    <p className="progress-pulse" data-i18n-skip role="note">
      <span className="progress-pulse-kicker">{t('quiet.pulseKicker')}</span>
      <span>{parts.join(' · ')}</span>
    </p>
  )
}
