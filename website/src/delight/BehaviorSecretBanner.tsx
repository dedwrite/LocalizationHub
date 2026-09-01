import { useEffect, useState } from 'react'
import { useI18n } from '@localizationhub/i18n'
import { discoverBehaviorSecret, markSecretSeen, type BehaviorSecret } from './behaviorSecrets'

export default function BehaviorSecretBanner({
  complete,
  justSaved = false,
}: {
  complete: boolean
  justSaved?: boolean
}) {
  const { t } = useI18n()
  const [secret, setSecret] = useState<BehaviorSecret | null>(null)

  useEffect(() => {
    const found = discoverBehaviorSecret({ complete, justSaved })
    if (!found) return
    setSecret(found)
    markSecretSeen(found.id)
  }, [complete, justSaved])

  if (!secret) return null

  return (
    <div className="behavior-secret" role="status" data-secret={secret.id} data-i18n-skip>
      <strong>{t(secret.titleKey)}</strong>
      <span>{t(secret.bodyKey)}</span>
      <button type="button" onClick={() => setSecret(null)} aria-label={t('quiet.dismiss')}>✕</button>
    </div>
  )
}
