import { useEffect, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'

export default function QualityCelebration({
  complete,
  projectName,
}: {
  complete: boolean
  projectName: string
}) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!complete) {
      setVisible(false)
      setDismissed(false)
      return
    }
    if (dismissed) return
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), 5200)
    return () => window.clearTimeout(timer)
  }, [complete, dismissed, projectName])

  if (!complete || !visible || dismissed) return null

  return (
    <div className="quality-celebration" role="status" data-i18n-skip>
      <div className="quality-celebration-glow" aria-hidden="true" />
      <div className="quality-celebration-copy">
        <strong>{t('quiet.shipIt')}</strong>
        <span>{t('quiet.shipItBody', { name: projectName })}</span>
      </div>
      <button type="button" className="quality-celebration-dismiss" onClick={() => { setDismissed(true); setVisible(false) }}>
        {t('quiet.dismiss')}
      </button>
    </div>
  )
}
