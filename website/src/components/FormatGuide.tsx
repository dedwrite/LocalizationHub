import { useState } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { InternalLink } from '../internalNavigation'

const options = ['files', 'godot', 'unreal', 'unity'] as const
const formats = {
  files: ['JSON', 'CSV', 'PO / POT'],
  godot: ['PCK', 'Scenes', 'PO / CSV', 'INKB'],
  unreal: ['LOCRES', 'LOCMETA', 'PAK', 'IOSTORE'],
  unity: ['TextAsset', 'Localization', 'MonoBehaviour'],
}

export default function FormatGuide() {
  const { t } = useI18n()
  const [selected, setSelected] = useState<(typeof options)[number]>('files')
  return (
    <div className="format-guide" id="formats" data-i18n-skip>
      <div
        className="format-options"
        role="group"
        aria-label={t('landing.formats.choose')}
      >
        {options.map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={selected === option}
            onClick={() => setSelected(option)}
          >
            <span aria-hidden="true">
              {option === 'files' ? '{ }' : option.slice(0, 1).toUpperCase()}
            </span>
            {t(`landing.formats.${option}.label`)}
          </button>
        ))}
      </div>
      <div className="format-result" aria-live="polite" aria-atomic="true">
        <div className="format-result-copy" key={selected}>
          <p className="eyebrow">
            {t(
              selected === 'files'
                ? 'landing.formats.browser'
                : 'landing.formats.desktop',
            )}
          </p>
          <h3>{t(`landing.formats.${selected}.title`)}</h3>
          <p>{t(`landing.formats.${selected}.body`)}</p>
          <div
            className="format-pills"
            aria-label={t('landing.formats.supported')}
          >
            {formats[selected].map((format) => (
              <bdi key={format}>{format}</bdi>
            ))}
          </div>
        </div>
        <InternalLink
          className="button button-primary"
          href={selected === 'files' ? '/app/local' : '/download'}
        >
          {t(
            selected === 'files'
              ? 'website.hero.openLocal'
              : 'landing.formats.getDesktop',
          )}
          <span aria-hidden="true">↗</span>
        </InternalLink>
      </div>
    </div>
  )
}
