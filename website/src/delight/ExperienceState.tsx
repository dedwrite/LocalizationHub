import { useI18n, type MessageKey } from '@localizationhub/i18n'

export function ExperienceSkeleton({ label, variant = 'projects' }: { label: MessageKey; variant?: 'projects' | 'workspace' | 'compact' }) {
  const { t } = useI18n()
  return <div className={`experience-skeleton skeleton-${variant}`} role="status" aria-live="polite" aria-label={t(label)} data-i18n-skip>
    <span className="sr-only">{t(label)}</span>
    <div className="skeleton-heading"><i /><i /></div>
    <div className="skeleton-grid"><i /><i /><i /></div>
  </div>
}

export function EmptyConstellation({ kind = 'project' }: { kind?: 'project' | 'search' | 'error' }) {
  return <span className={`empty-graphic empty-constellation empty-${kind}`} aria-hidden="true"><i /><i /><i /><b /></span>
}
