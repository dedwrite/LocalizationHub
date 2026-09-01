import { useI18n } from '@localizationhub/i18n'
import { lengthCue } from './textLength'

export default function TranslationLengthCue({
  source,
  translation,
}: {
  source: string
  translation: string
}) {
  const { t } = useI18n()
  const cue = lengthCue(source, translation)
  if (cue.kind === 'empty') return null

  const label =
    cue.kind === 'short' ? t('quiet.lengthShort')
      : cue.kind === 'long' ? t('quiet.lengthLong')
        : cue.kind === 'very-long' ? t('quiet.lengthVeryLong')
          : t('quiet.lengthBalanced')

  return (
    <div className="length-cue" data-kind={cue.kind} data-i18n-skip>
      <div className="length-cue-meta">
        <span>{t('quiet.lengthCompare', { source: cue.sourceChars, translation: cue.translationChars })}</span>
        {(cue.kind === 'long' || cue.kind === 'very-long' || cue.kind === 'short') && <em>{label}</em>}
      </div>
      <div className="length-cue-track" aria-hidden="true">
        <span className="length-cue-fill" style={{ width: `${cue.fill}%` }} />
        <span className="length-cue-mark" />
      </div>
    </div>
  )
}
