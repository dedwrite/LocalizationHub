import { TOKEN_PROFILE_LABELS, type TokenProfileConfig } from '@localizationhub/core'
import { useI18n } from '@localizationhub/i18n'

export default function TokenProfileStatus({ config }: { config: TokenProfileConfig }) {
  const { t } = useI18n()
  const { engine, confidence } = config.detection
  const engineName = engine === 'unknown' ? 'Generic' : TOKEN_PROFILE_LABELS[engine]
  const message = config.mode === 'auto'
    ? engine === 'unknown' ? t('profile.unknown') : t('profile.detected', { engine: engineName, confidence: t(confidence === 'high' ? 'profile.high' : confidence === 'medium' ? 'profile.medium' : 'profile.low') })
    : engine !== 'unknown' && config.selectedProfile !== engine
      ? t('profile.mismatch', { engine: engineName }) : t('profile.manual')
  return <span data-i18n-skip>{message}</span>
}
