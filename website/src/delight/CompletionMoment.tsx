import { useEffect, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'

function dismissed(key: string) {
  try { return sessionStorage.getItem(key) === '1' } catch { return false }
}

export default function CompletionMoment({ projectId, complete, onReview }: {
  projectId: string
  complete: boolean
  onReview: () => void
}) {
  const { t } = useI18n()
  const storageKey = `localizationhub.delight.complete.${projectId}`
  const [visible, setVisible] = useState(() => complete && !dismissed(storageKey))

  useEffect(() => {
    if (complete && !dismissed(storageKey)) setVisible(true)
    if (!complete) setVisible(false)
  }, [complete, storageKey])

  if (!complete || !visible) return null
  function dismiss() {
    try { sessionStorage.setItem(storageKey, '1') } catch { /* Optional preference only. */ }
    setVisible(false)
  }
  return <aside className="completion-moment" role="status" data-i18n-skip>
    <span className="completion-orbit" aria-hidden="true"><i /></span>
    <div><span className="completion-kicker">{t('delight.complete.kicker')}</span><strong>{t('delight.complete.title')}</strong><p>{t('delight.complete.body')}</p></div>
    <button type="button" className="completion-review" onClick={onReview}>{t('delight.complete.review')}<span aria-hidden="true">↗</span></button>
    <button type="button" className="completion-dismiss" onClick={dismiss} aria-label={t('delight.complete.dismiss')}>×</button>
  </aside>
}
