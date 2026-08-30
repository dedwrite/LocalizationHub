import { useI18n, type MessageKey } from '@localizationhub/i18n'
import { coverage } from './recents'

export default function ResumeCard({ name, total, translated, position = 0, kind, onOpen }: {
  name: string; total: number; translated: number; position?: number
  kind: 'local' | 'cloud-opened' | 'cloud-updated'; onOpen: () => void
}) {
  const { t } = useI18n()
  const counts = coverage(total, translated)
  const countLabel = t('delight.coverage', { total: counts.total, translated: counts.translated })
  const local = kind === 'local'
  const label: MessageKey = local ? 'delight.lastSaved' : kind === 'cloud-opened' ? 'delight.lastOpened' : 'delight.updated'
  return <section className="resume-card" aria-label={t('delight.resume')} data-i18n-skip>
    <div className="resume-emblem" aria-hidden="true"><span>{'{'}<i />{'}'}</span></div>
    <div className="resume-copy"><span className="resume-kicker">{t(label)}</span><h2>{t('delight.resume')}</h2><strong className="resume-name"><bdi>{name}</bdi></strong><p>{t(local ? 'delight.localOnly' : 'delight.cloudFresh')}</p></div>
    <div className="resume-progress"><div><span>{countLabel}</span><strong>{counts.percent}%</strong></div><progress max={counts.total || 1} value={counts.translated} aria-label={countLabel} />
      {local && position > 0 && position <= counts.total && <small>{t('delight.savedEntry', { position, total: counts.total })}</small>}
      {counts.complete && <small className="resume-milestone">{t('delight.allText')}</small>}
      <button type="button" onClick={onOpen}>{t(local ? 'delight.resumeLocal' : 'delight.resumeCloud')}<span aria-hidden="true">↗</span></button>
    </div>
  </section>
}
