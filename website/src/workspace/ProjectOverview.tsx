import { calculateProjectStatistics, createTokenProfileConfig, displayTokenProfile, type TokenProfileConfig } from '@localizationhub/core'

/*
 * Unobtrusive Project Overview panel showing key project facts.
 */
export default function ProjectOverview({
  snapshot,
  draft,
  memberCount,
  tokenProfileId,
  tokenProfileConfig,
  role,
  onClose,
}: {
  snapshot: { name: string; revision: number; updatedAt: string; role: string }
  draft: any
  memberCount: number
  tokenProfileId: string
  tokenProfileConfig?: TokenProfileConfig
  role: string
  onClose: () => void
}) {
  const stats = calculateProjectStatistics(draft.entries ?? [], draft.workflow?.entries ?? {})
  const format = draft.format === 'LocalizationHubProject' ? 'LocalizationHub Project' : draft.format ?? 'LocalizationHub Project'

  return (
    <div className="overview-panel">
      <div className="overview-head">
        <h2>Project Overview</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close overview">×</button>
      </div>
      <dl className="detail-list">
        <dt>Name</dt><dd>{snapshot.name}</dd>
        <dt>Format</dt><dd>{format}</dd>
        <dt>Source file</dt><dd>{draft.sourceFileName || '—'}</dd>
        <dt>Revision</dt><dd>{snapshot.revision}</dd>
        <dt>Role</dt><dd>{role}</dd>
        <dt>Members</dt><dd>{memberCount}</dd>
        <dt>Token profile</dt><dd>{displayTokenProfile(tokenProfileConfig ?? createTokenProfileConfig(tokenProfileId as any))}</dd>
        <dt>Total entries</dt><dd>{stats.total}</dd>
        <dt>Translated</dt><dd>{stats.translated} ({stats.translationCompletion}%)</dd>
        <dt>Needs review</dt><dd>{stats.needsReview}</dd>
        <dt>Approved</dt><dd>{stats.approved}</dd>
        <dt>Updated</dt><dd>{new Date(snapshot.updatedAt).toLocaleString()}</dd>
      </dl>
    </div>
  )
}
