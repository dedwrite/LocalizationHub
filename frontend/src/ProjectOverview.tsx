import type { ProjectStatistics } from '@localizationhub/core'
import './ProjectOverview.css'
import { ProjectDangerZone } from './ProjectDeleteDialog'

type Props = { statistics: ProjectStatistics; onClose: () => void; onDelete?: () => void }
export default function ProjectOverview({ statistics, onClose, onDelete }: Props) {
  return <div className="overview-backdrop" role="presentation" onClick={onClose}><section className="project-overview" role="dialog" aria-modal="true" aria-label="Project Overview" onClick={(event) => event.stopPropagation()}><header><strong>Project Overview</strong><button type="button" onClick={onClose} aria-label="Close overview">Close</button></header><div className="overview-grid"><span>Total entries<strong>{statistics.total}</strong></span><span>Untranslated<strong>{statistics.untranslated}</strong></span><span>Draft<strong>{statistics.draft}</strong></span><span>Translated<strong>{statistics.translated}</strong></span><span>Needs Review<strong>{statistics.needsReview}</strong></span><span>Approved<strong>{statistics.approved}</strong></span><span>Translation Completion<strong>{statistics.translationCompletion}%</strong></span><span>Approval Completion<strong>{statistics.approvalCompletion}%</strong></span><span>Source words<strong>{statistics.sourceWords}</strong></span><span>Translated words<strong>{statistics.translatedWords}</strong></span><span>Remaining words<strong>{statistics.remainingWords}</strong></span></div>{onDelete && <ProjectDangerZone onDelete={onDelete} />}</section></div>
}
