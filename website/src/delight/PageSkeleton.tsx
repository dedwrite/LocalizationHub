export type SkeletonKind = 'projects' | 'workspace' | 'admin'

export default function PageSkeleton({ kind }: { kind: SkeletonKind }) {
  if (kind === 'projects') {
    return (
      <div className="page-skeleton page-skeleton-projects" aria-busy="true" aria-live="polite" data-i18n-skip>
        <div className="skel-line skel-kicker" />
        <div className="skel-line skel-title" />
        <div className="skel-resume" />
        <div className="skel-grid">
          <div className="skel-card" /><div className="skel-card" /><div className="skel-card" />
        </div>
      </div>
    )
  }
  if (kind === 'admin') {
    return (
      <div className="page-skeleton page-skeleton-admin" aria-busy="true" aria-live="polite" data-i18n-skip>
        <div className="skel-line skel-title" />
        <div className="skel-admin-row" />
        <div className="skel-admin-row" />
        <div className="skel-admin-row" />
      </div>
    )
  }
  return (
    <div className="page-skeleton page-skeleton-workspace" aria-busy="true" aria-live="polite" data-i18n-skip>
      <div className="skel-workspace-bar" />
      <div className="skel-workspace-body">
        <div className="skel-pane" />
        <div className="skel-pane skel-pane-main" />
        <div className="skel-pane" />
      </div>
    </div>
  )
}
