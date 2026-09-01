import type { ReactNode } from 'react'
import { useI18n, type MessageKey } from '@localizationhub/i18n'

export type EmptyKind = 'projects' | 'search' | 'entries' | 'review-done' | 'quality-clean' | 'loading'

const COPY: Record<Exclude<EmptyKind, 'loading'>, { title: MessageKey; body: MessageKey }> = {
  projects: { title: 'quiet.emptyProjectsTitle', body: 'quiet.emptyProjectsBody' },
  search: { title: 'quiet.emptySearchTitle', body: 'quiet.emptySearchBody' },
  entries: { title: 'quiet.emptyEntriesTitle', body: 'quiet.emptyEntriesBody' },
  'review-done': { title: 'quiet.emptyReviewTitle', body: 'quiet.emptyReviewBody' },
  'quality-clean': { title: 'quiet.emptyQualityTitle', body: 'quiet.emptyQualityBody' },
}

export default function EmptyState({
  kind,
  action,
  title,
  body,
}: {
  kind: EmptyKind
  action?: ReactNode
  title?: string
  body?: string
}) {
  const { t } = useI18n()
  if (kind === 'loading') {
    return (
      <div className="empty-state loading-state quiet-empty" data-empty={kind} data-i18n-skip>
        <span className="empty-graphic quiet-empty-art" aria-hidden="true"><i /><i /><i /></span>
        <strong>{title ?? t('quiet.loadingGeneric')}</strong>
        {body && <span>{body}</span>}
      </div>
    )
  }
  const keys = COPY[kind]
  return (
    <div className="empty-state intentional-empty quiet-empty" data-empty={kind} data-i18n-skip>
      <span className="empty-graphic quiet-empty-art" aria-hidden="true" data-art={kind}><i /><i /><i /></span>
      <strong>{title ?? t(keys.title)}</strong>
      <span>{body ?? t(keys.body)}</span>
      {action}
    </div>
  )
}
