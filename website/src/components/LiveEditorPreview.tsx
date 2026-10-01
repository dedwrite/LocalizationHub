import { useId, useState } from 'react'
import { validateProtectedTokens } from '@localizationhub/core/tokens'
import { useI18n } from '@localizationhub/i18n'

const samples = [
  {
    key: 'quest.northern_gate',
    source: 'Hold the line, {player_name}.',
    translation: 'اثبت يا {player_name}.',
  },
  { key: 'ui.menu.start', source: 'Start game', translation: 'ابدأ اللعبة' },
  {
    key: 'npc.veyra.line',
    source: 'The <b>Northern Gate</b> holds.',
    translation: 'لا تزال <b>البوابة الشمالية</b> صامدة.',
  },
] as const

export default function LiveEditorPreview() {
  const { t } = useI18n()
  const id = useId()
  const [selected, setSelected] = useState(0)
  const [translations, setTranslations] = useState<string[]>(
    samples.map((sample) => sample.translation),
  )
  const sample = samples[selected]
  const translation = translations[selected]
  const validation = validateProtectedTokens(
    sample.source,
    translation,
    'generic',
  )
  const state = !translation.trim()
    ? 'empty'
    : validation.hasErrors
      ? 'error'
      : validation.hasWarnings
        ? 'warning'
        : 'valid'
  const statusKey = {
    empty: 'landing.try.empty',
    error: 'landing.try.error',
    warning: 'landing.try.warning',
    valid: 'landing.try.valid',
  } as const
  const change = (value: string) =>
    setTranslations((current) =>
      current.map((text, index) => (index === selected ? value : text)),
    )

  return (
    <div className="live-preview" data-i18n-skip>
      <div className="live-preview-heading">
        <span className="live-dot" aria-hidden="true" />
        <strong>{t('landing.try.title')}</strong>
        <span>{t('landing.try.badge')}</span>
      </div>
      <div className="editor-preview">
        <div
          className="preview-sidebar"
          role="group"
          aria-label={t('landing.try.entries')}
        >
          <div className="preview-sidebar-top">
            <span>{t('projects.entriesCaps')}</span>
            <bdi>3</bdi>
          </div>
          {samples.map((entry, index) => (
            <button
              type="button"
              key={entry.key}
              className={`preview-entry${selected === index ? ' selected' : ''}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <span className="preview-entry-number" aria-hidden="true">
                0{index + 1}
              </span>
              <span>
                <span className="preview-short-label">
                  {t(
                    (
                      [
                        'landing.try.dialogue',
                        'landing.try.menu',
                        'landing.try.formatting',
                      ] as const
                    )[index],
                  )}
                </span>
                <strong dir="ltr" translate="no">{entry.key}</strong>
                <small lang="en" dir="ltr">
                  {entry.source}
                </small>
              </span>
            </button>
          ))}
        </div>
        <div className="preview-main">
          <div className="preview-breadcrumb">
            <bdi translate="no">{sample.key}</bdi>
            <span dir="ltr">
              {selected + 1} / {samples.length}
            </span>
          </div>
          <div className="preview-source">
            <span className="preview-field-label">{t('workspace.source')}</span>
            <p lang="en" dir="ltr" data-i18n-content>
              {sample.source}
            </p>
          </div>
          <div className="preview-translation">
            <div className="translation-label">
              <label htmlFor={id}>{t('landing.try.translation')}</label>
              <button
                type="button"
                className="preview-reset"
                onClick={() => change(sample.translation)}
              >
                {t('landing.try.reset')}
              </button>
            </div>
            <textarea
              id={id}
              name="sample-translation"
              autoComplete="off"
              value={translation}
              onChange={(event) => change(event.target.value)}
              lang="ar"
              dir="auto"
              spellCheck={false}
              maxLength={2000}
              aria-describedby={`${id}-hint ${id}-status`}
              data-i18n-content
            />
            <p id={`${id}-hint`} className="preview-hint">
              {t(
                selected === 0
                  ? 'landing.try.hint'
                  : selected === 1
                    ? 'landing.try.menuHint'
                    : 'landing.try.tagHint',
              )}
            </p>
          </div>
          {validation.sourceTokens.length > 0 && (
            <div className="preview-token-guide">
              <p>{t('landing.try.keepTokens')}</p>
              <ul aria-label={t('landing.try.keepTokens')}>
                {validation.sourceTokens.map((token, index) => {
                  const missing = validation.missingTokens.some(
                    (item) => item.raw === token.raw,
                  )
                  return (
                    <li key={`${token.raw}-${index}`} data-missing={missing}>
                      <span aria-hidden="true">{missing ? '!' : '✓'}</span>
                      <code dir="ltr" translate="no">{token.raw}</code>
                      <span>
                        {t(
                          missing
                            ? 'landing.try.tokenMissing'
                            : 'landing.try.tokenKept',
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <div
            id={`${id}-status`}
            className={`preview-check is-${state}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span aria-hidden="true">
              {state === 'valid' ? '✓' : state === 'empty' ? '○' : '!'}
            </span>
            {t(statusKey[state])}
          </div>
        </div>
      </div>
    </div>
  )
}
