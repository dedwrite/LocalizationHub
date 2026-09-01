import { useI18n } from '@localizationhub/i18n'
import type { GlossaryEntry } from '@localizationhub/core'
import { glossaryNudges } from './glossaryHints'

export default function GlossaryHint({
  source,
  translation,
  glossary,
}: {
  source: string
  translation: string
  glossary: GlossaryEntry[]
}) {
  const { t } = useI18n()
  const nudges = glossaryNudges(source, translation, glossary)
  if (nudges.length === 0) return null

  return (
    <div className="glossary-nudge" data-i18n-skip role="note">
      <span className="glossary-nudge-kicker">{t('quiet.glossaryNudge')}</span>
      <ul>
        {nudges.map((item) => (
          <li key={`${item.sourceTerm}:${item.preferredTranslation}`} data-kind={item.forbiddenHit ? 'forbidden' : 'preferred'}>
            <strong><bdi>{item.sourceTerm}</bdi></strong>
            {item.forbiddenHit
              ? <span>{t('quiet.glossaryForbidden', { term: item.forbiddenHit })}</span>
              : item.preferredTranslation
                ? <span>{t('quiet.glossaryPrefer', { term: item.preferredTranslation })}</span>
                : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
